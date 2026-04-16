// ---------------------------------------------------------------------------
// Built-in named entity map  (name → replacement string)
// No regex, no {regex,val} objects — just flat key/value pairs.
// ---------------------------------------------------------------------------

import { XML as DEFAULT_XML_ENTITIES } from "./entities.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPECIAL_CHARS = new Set('!?\\\\/[]$%{}^&*()<>|+');

/**
 * Validate that an entity name contains no dangerous characters.
 * @param {string} name
 * @returns {string} the name, unchanged
 * @throws {Error} on invalid characters
 */
function validateEntityName(name) {
  if (name[0] === '#') {
    throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${name}"`);
  }
  for (const ch of name) {
    if (SPECIAL_CHARS.has(ch)) {
      throw new Error(`[EntityReplacer] Invalid character '${ch}' in entity name: "${name}"`);
    }
  }
  return name;
}

/**
 * Merge one or more entity maps into a flat name→string map.
 * Accepts either:
 *   - plain string values:             { amp: '&' }
 *   - legacy {regex,val} / {regx,val}: { lt: { regex: /.../, val: '<' } }
 *
 * Values containing '&' are skipped (recursive expansion risk).
 *
 * @param {...object} maps
 * @returns {Record<string, string>}
 */
function mergeEntityMaps(...maps) {
  const out = Object.create(null);
  for (const map of maps) {
    if (!map) continue;
    for (const key of Object.keys(map)) {
      const raw = map[key];
      if (typeof raw === 'string') {
        out[key] = raw;
      } else if (raw && typeof raw === 'object' && raw.val !== undefined) {
        // Legacy {regex,val} or {regx,val} — extract the string val only
        const val = raw.val;
        if (typeof val === 'string') {
          out[key] = val;
        }
        // function vals are not supported in the scanner — skip
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// applyLimitsTo helpers
// ---------------------------------------------------------------------------

const LIMIT_TIER_EXTERNAL = 'external'; // input/runtime + persistent external maps
const LIMIT_TIER_BASE = 'base';     // DEFAULT_XML_ENTITIES + namedEntities (system) maps
const LIMIT_TIER_ALL = 'all';      // every entity regardless of tier

/**
 * Resolve `applyLimitsTo` option into a normalised Set of tier strings.
 * Accepted values: 'external' | 'base' | 'all' | string[]
 * Default: 'external' (only untrusted injected entities are counted).
 * @param {string|string[]|undefined} raw
 * @returns {Set<string>}
 */
function parseLimitTiers(raw) {
  if (!raw || raw === LIMIT_TIER_EXTERNAL) return new Set([LIMIT_TIER_EXTERNAL]);
  if (raw === LIMIT_TIER_ALL) return new Set([LIMIT_TIER_ALL]);
  if (raw === LIMIT_TIER_BASE) return new Set([LIMIT_TIER_BASE]);
  if (Array.isArray(raw)) return new Set(raw);
  return new Set([LIMIT_TIER_EXTERNAL]); // safe default for unrecognised values
}

// ---------------------------------------------------------------------------
// EntityReplacer
// ---------------------------------------------------------------------------

/**
 * Single-pass, zero-regex entity replacer for XML/HTML content.
 *
 * Algorithm: scan the string once for '&', read to ';', resolve via map
 * or direct codepoint conversion, build output chunks, join once at the end.
 *
 * Entity lookup priority (highest → lowest):
 *   1. input / runtime  (DOCTYPE entities for current document)
 *   2. persistent external (survive across documents)
 *   3. base named map   (DEFAULT_XML_ENTITIES + user-supplied namedEntities)
 *
 * Both input and external resolve as the 'external' tier for limit purposes.
 * Base map entities resolve as the 'base' tier.
 *
 * Numeric / hex references (&#NNN; / &#xHH;) are resolved directly via
 * String.fromCodePoint() — no map needed. They count as 'base' tier.
 *
 * @example
 * const replacer = new EntityReplacer({ namedEntities: COMMON_HTML });
 * replacer.setExternalEntities({ brand: 'Acme' });
 *
 * const instance = replacer.reset();
 * instance.addInputEntities({ version: '1.0' });
 * instance.encode('&brand; v&version; &lt;'); // 'Acme v1.0 <'
 */
export default class EntityDecoder {
  /**
   * @param {object} [options]
   * @param {object|null}  [options.namedEntities]        — extra named entities merged into base map
   * @param {number}       [options.maxTotalExpansions=0]  — 0 = unlimited
   * @param {number}       [options.maxExpandedLength=0]   — 0 = unlimited
   * @param {'external'|'base'|'all'|string[]} [options.applyLimitsTo='external']
   *   Which entity tiers count against the security limits:
   *   - 'external' (default) — only input/runtime + persistent external entities
   *   - 'base'               — only DEFAULT_XML_ENTITIES + namedEntities
   *   - 'all'                — every entity regardless of tier
   *   - string[]             — explicit combination, e.g. ['external', 'base']
   * @param {((resolved: string, original: string) => string)|null} [options.postCheck=null]
   * @param {string[]} [options.remove=[]] — entity names (e.g. ['nbsp', '#13']) to delete (replace with empty string)
   * @param {string[]} [options.leave=[]]  — entity names to keep as literal (unchanged in output)
   */
  constructor(options = {}) {
    this._maxTotalExpansions = options.maxTotalExpansions || 0;
    this._maxExpandedLength = options.maxExpandedLength || 0;
    this._postCheck = typeof options.postCheck === 'function' ? options.postCheck : r => r;
    this._limitTiers = parseLimitTiers(options.applyLimitsTo ?? LIMIT_TIER_EXTERNAL);
    this._numericAllowed = options.numericAllowed ?? true;
    // Base map: DEFAULT_XML_ENTITIES + user-supplied extras. Immutable after construction.
    this._baseMap = mergeEntityMaps(DEFAULT_XML_ENTITIES, options.namedEntities || null);

    // Persistent external entities — survive across documents.
    // Stored as a separate map so reset() never touches them.
    /** @type {Record<string, string>} */
    this._externalMap = Object.create(null);

    // Input / runtime entities — current document only, wiped on reset().
    /** @type {Record<string, string>} */
    this._inputMap = Object.create(null);

    // Per-document counters
    this._totalExpansions = 0;
    this._expandedLength = 0;

    // --- New: remove / leave sets ---
    /** @type {Set<string>} */
    this._removeSet = new Set(options.remove && Array.isArray(options.remove) ? options.remove : []);
    /** @type {Set<string>} */
    this._leaveSet = new Set(options.leave && Array.isArray(options.leave) ? options.leave : []);
  }

  // -------------------------------------------------------------------------
  // Persistent external entity registration
  // -------------------------------------------------------------------------

  /**
   * Replace the full set of persistent external entities.
   * All keys are validated — throws on invalid characters.
   * @param {Record<string, string | { regex?: RegExp, val: string }>} map
   */
  setExternalEntities(map) {
    if (map) {
      for (const key of Object.keys(map)) {
        validateEntityName(key);
      }
    }
    this._externalMap = mergeEntityMaps(map);
  }

  /**
   * Add a single persistent external entity.
   * @param {string} key
   * @param {string} value
   */
  addExternalEntity(key, value) {
    validateEntityName(key);
    if (typeof value === 'string' && value.indexOf('&') === -1) {
      this._externalMap[key] = value;
    }
  }

  // -------------------------------------------------------------------------
  // Input / runtime entity registration (per document)
  // -------------------------------------------------------------------------

  /**
   * Inject DOCTYPE entities for the current document.
   * Also resets per-document expansion counters.
   * @param {Record<string, string | { regx?: RegExp, regex?: RegExp, val: string }>} map
   */
  addInputEntities(map) {
    this._totalExpansions = 0;
    this._expandedLength = 0;
    this._inputMap = mergeEntityMaps(map);
  }

  // -------------------------------------------------------------------------
  // Per-document reset
  // -------------------------------------------------------------------------

  /**
   * Wipe input/runtime entities and reset counters.
   * Call this before processing each new document.
   * @returns {this}
   */
  reset() {
    this._inputMap = Object.create(null);
    this._totalExpansions = 0;
    this._expandedLength = 0;
    return this;
  }

  // -------------------------------------------------------------------------
  // Primary API
  // -------------------------------------------------------------------------

  /**
   * Replace all entity references in `str` in a single pass.
   *
   * @param {string} str
   * @returns {string}
   */
  decode(str) {
    if (typeof str !== 'string' || str.length === 0) return str;
    //TODO: check if needed
    //if (str.indexOf('&') === -1) return str; // fast path — no entities at all

    const original = str;
    const chunks = [];
    const len = str.length;
    let last = 0; // start of next unprocessed literal chunk
    let i = 0;

    const limitExpansions = this._maxTotalExpansions > 0;
    const limitLength = this._maxExpandedLength > 0;
    const checkLimits = limitExpansions || limitLength;

    while (i < len) {
      // Scan forward to next '&'
      if (str.charCodeAt(i) !== 38 /* '&' */) { i++; continue; }

      // --- Found '&' at position i ---

      // Scan forward to ';'
      let j = i + 1;
      while (j < len && str.charCodeAt(j) !== 59 /* ';' */ && (j - i) <= 32) j++;

      if (j >= len || str.charCodeAt(j) !== 59) {
        // No closing ';' within window — treat '&' as literal
        i++;
        continue;
      }

      // Raw token between '&' and ';' (exclusive)
      const token = str.slice(i + 1, j);
      if (token.length === 0) { i++; continue; }

      let replacement;
      let tier; // which limit tier this entity belongs to

      if (this._removeSet.has(token)) {
        // Remove entity: replace with empty string
        replacement = '';
        // If entity was unknown (replacement undefined), we still need a tier for limits.
        // Treat as external tier because it's user-directed removal of an unknown reference.
        if (tier === undefined) {
          tier = LIMIT_TIER_EXTERNAL;
        }
      } else if (this._leaveSet.has(token)) {
        // Do not replace — keep original &token; as literal
        i++;
        continue;
      } else if (token.charCodeAt(0) === 35 /* '#' */ && this._numericAllowed) {
        // ---- Numeric reference — base tier ----
        replacement = this._resolveNumeric(token);
        tier = LIMIT_TIER_BASE;
      } else {
        // ---- Named reference ----
        const resolved = this._resolveName(token);
        replacement = resolved?.value;
        tier = resolved?.tier;
      }

      if (replacement === undefined) {
        // Unknown entity — leave as-is, advance past '&' only
        i++;
        continue;
      }

      // Flush literal chunk before this entity
      if (i > last) chunks.push(str.slice(last, i));
      chunks.push(replacement);
      last = j + 1; // skip past ';'
      i = last;

      // Apply expansion limits only if this tier is being tracked
      if (checkLimits && this._tierCounts(tier)) {
        if (limitExpansions) {
          this._totalExpansions++;
          if (this._totalExpansions > this._maxTotalExpansions) {
            throw new Error(
              `[EntityReplacer] Entity expansion count limit exceeded: ` +
              `${this._totalExpansions} > ${this._maxTotalExpansions}`
            );
          }
        }
        if (limitLength) {
          // delta: replacement.length minus the raw &token; length (token.length + 2 for '&' and ';')
          const delta = replacement.length - (token.length + 2);
          if (delta > 0) {
            this._expandedLength += delta;
            if (this._expandedLength > this._maxExpandedLength) {
              throw new Error(
                `[EntityReplacer] Expanded content length limit exceeded: ` +
                `${this._expandedLength} > ${this._maxExpandedLength}`
              );
            }
          }
        }
      }
    }

    // Flush trailing literal
    if (last < len) chunks.push(str.slice(last));

    // If nothing was replaced, chunks is empty — return original
    const result = chunks.length === 0 ? str : chunks.join('');

    return this._postCheck(result, original);
  }

  // -------------------------------------------------------------------------
  // Private: limit tier check
  // -------------------------------------------------------------------------

  /**
   * Returns true if a resolved entity of the given tier should count
   * against the expansion/length limits.
   * @param {string} tier  — LIMIT_TIER_EXTERNAL | LIMIT_TIER_BASE
   * @returns {boolean}
   */
  _tierCounts(tier) {
    if (this._limitTiers.has(LIMIT_TIER_ALL)) return true;
    return this._limitTiers.has(tier);
  }

  // -------------------------------------------------------------------------
  // Private: entity resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve a named entity token (without & and ;).
   * Priority: inputMap > externalMap > baseMap
   * Returns the resolved value tagged with its limit tier.
   *
   * @param {string} name
   * @returns {{ value: string, tier: string }|undefined}
   */
  _resolveName(name) {
    // input and external both count as 'external' tier for limit purposes —
    // they are injected at runtime and are the untrusted surface.
    if (name in this._inputMap) return { value: this._inputMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._externalMap) return { value: this._externalMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._baseMap) return { value: this._baseMap[name], tier: LIMIT_TIER_BASE };
    return undefined;
  }

  /**
   * Resolve a numeric entity token (the part after '&', including '#').
   * Handles &#NNN; and &#xHH; (case-insensitive x).
   *
   * @param {string} token  — e.g. '#38', '#x26', '#X26'
   * @returns {string|undefined}
   */
  _resolveNumeric(token) {
    const second = token.charCodeAt(1);

    let codePoint;

    if (second === 120 || second === 88) {
      // &#xHH; or &#XHH; — hex
      // token is like 'x0026' — slice off 'x', leading zeros handled by parseInt
      codePoint = parseInt(token.slice(2), 16);
    } else {
      // &#NNN; — decimal
      // token is like '0038'
      codePoint = parseInt(token.slice(1), 10);
    }

    if (Number.isNaN(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) {
      return undefined; // invalid — leave as-is
    }

    return String.fromCodePoint(codePoint);
  }
}