// ---------------------------------------------------------------------------
// Built-in entity tables
// ---------------------------------------------------------------------------

/**
 * Standard XML entities — always processed after external/system so they
 * cannot be overridden by DOCTYPE, and &amp; is deferred to its own final pass.
 *
 * Each entry: { regex: RegExp, val: string }
 */
const DEFAULT_XML_ENTITIES = {
  apos: { regex: /&(apos|#0*39|#x0*27);/g, val: "'" },
  gt: { regex: /&(gt|#0*62|#x0*3[Ee]);/g, val: '>' },
  lt: { regex: /&(lt|#0*60|#x0*3[Cc]);/g, val: '<' },
  quot: { regex: /&(quot|#0*34|#x0*22);/g, val: '"' },
};

/** &amp; — always expanded last to avoid double-expansion. */
const AMP_ENTITY = { regex: /&(amp|#0*38|#x0*26);/g, val: '&' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPECIAL_CHARS = new Set('!?\\\\/[]$%{}^&*()<>|+');

/**
 * Validate that an entity name contains no regex-special or otherwise
 * dangerous characters.
 * @param {string} name
 * @returns {string} the name, unchanged
 * @throws {Error} on invalid characters
 */
function validateEntityName(name) {
  for (const ch of name) {
    if (SPECIAL_CHARS.has(ch)) {
      throw new Error(`[EntityReplacer] Invalid character '${ch}' in entity name: "${name}"`);
    }
  }
  return name;
}

/**
 * Escape a string for use inside a RegExp character class / alternation.
 */
function escapeForRegex(str) {
  return str.replace(/[.\-+*:]/g, '\\$&');
}

/**
 * Resolve a constructor option to an entity table (plain object) or null.
 */
function resolveTable(option, builtIn, enabledByDefault = false) {
  if (option === false || option === null) return null;
  if (option === true) return builtIn;
  if (option === undefined) return enabledByDefault ? builtIn : null;
  if (typeof option === 'object') return option;
  return null;
}

/**
 * Convert a category name or array of names into a Set<string>.
 */
function resolveApplyLimitsTo(spec) {
  if (spec === 'all') return 'all';
  if (typeof spec === 'string') return new Set([spec]);
  if (Array.isArray(spec)) return new Set(spec);
  return new Set(['external']);
}

/**
 * Build an entries array from a raw map of name → string|{regex,val}.
 * Skips string values that contain '&' (recursive expansion risk).
 * Normalises DocTypeReader's `regx` spelling to `regex`.
 *
 * @param {object} map
 * @returns {Array<[string, {regex: RegExp, val: string}]>}
 */
function buildEntries(map) {
  const entries = [];
  for (const key of Object.keys(map)) {
    const raw = map[key];
    if (typeof raw === 'object' && raw !== null && (raw.val !== undefined)) {
      // Accept pre-built { regex, val } or DocTypeReader's { regx, val }
      entries.push([key, { regex: raw.regex ?? raw.regx, val: raw.val }]);
    } else if (typeof raw === 'string') {
      if (raw.indexOf('&') !== -1) continue; // skip — would cause recursive expansion
      validateEntityName(key);
      entries.push([key, {
        regex: new RegExp('&' + escapeForRegex(key) + ';', 'g'),
        val: raw,
      }]);
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// EntityReplacer
// ---------------------------------------------------------------------------

/**
 * Standalone, zero-dependency entity replacer for XML/HTML content.
 *
 * Entity categories:
 *  - **persistent external** — configured once, survive across documents.
 *    Set via `setExternalEntities()` or built up via `addExternalEntity()`.
 *  - **input / runtime** — DOCTYPE entities for the *current* document only.
 *    Injected via `addInputEntities()`. Wiped on every `getInstance()` call
 *    so they never leak between documents.
 *
 * Replacement order (fixed):
 *   1. persistent external
 *   2. input / runtime  (DOCTYPE)
 *   3. system           (named entity groups)
 *   4. default          (lt / gt / apos / quot)
 *   5. amp              (&amp; final pass)
 *
 * @example
 * const replacer = new EntityReplacer({ default: true, system: COMMON_HTML });
 * replacer.setExternalEntities({ brand: 'Acme' });
 *
 * // Builder factory calls getInstance() before each document:
 * const instance = replacer.getInstance();
 * // Builder calls addInputEntities() if DOCTYPE entities are present:
 * instance.addInputEntities({ version: '1.0' });
 * instance.replace('&brand; v&version; &lt;'); // 'Acme v1.0 <'
 */
export default class EntityReplacer {
  /**
   * @param {object} [options]
   * @param {boolean|object|null} [options.default=true]
   * @param {boolean|object|null} [options.amp=true]
   * @param {boolean|object|null} [options.system=false]
   * @param {number}              [options.maxTotalExpansions=0]
   * @param {number}              [options.maxExpandedLength=0]
   * @param {'external'|'all'|string[]} [options.applyLimitsTo='external']
   * @param {((resolved: string, original: string) => string)|null} [options.postCheck=null]
   */
  constructor(options = {}) {
    // Immutable config resolved at construction
    this._defaultTable = resolveTable(options.default, DEFAULT_XML_ENTITIES, true);
    this._systemTable = resolveTable(options.system, null, false);
    this._ampEnabled = options.amp !== false && options.amp !== null;

    this._maxTotalExpansions = options.maxTotalExpansions || 0;
    this._maxExpandedLength = options.maxExpandedLength || 0;
    this._applyLimitsTo = resolveApplyLimitsTo(options.applyLimitsTo ?? 'external');
    this._postCheck = typeof options.postCheck === 'function' ? options.postCheck : r => r;

    // Pre-computed category limit flags
    this._limitExternal = this._applyLimitsTo === 'all' || (this._applyLimitsTo instanceof Set && this._applyLimitsTo.has('external'));
    this._limitSystem = this._applyLimitsTo === 'all' || (this._applyLimitsTo instanceof Set && this._applyLimitsTo.has('system'));
    this._limitDefault = this._applyLimitsTo === 'all' || (this._applyLimitsTo instanceof Set && this._applyLimitsTo.has('default'));

    // Frozen immutable entry arrays
    this._defaultEntries = this._defaultTable ? Object.entries(this._defaultTable) : [];
    this._systemEntries = this._systemTable ? Object.entries(this._systemTable) : [];

    // Persistent external entities — survive across documents
    /** @type {Array<[string, {regex: RegExp, val: string}]>} */
    this._persistentEntries = [];

    // Input / runtime entities — current document only, reset per getInstance()
    /** @type {Array<[string, {regex: RegExp, val: string}]>} */
    this._inputEntries = [];

    // Per-document counters — reset in getInstance()
    this._totalExpansions = 0;
    this._expandedLength = 0;
  }

  // -------------------------------------------------------------------------
  // Persistent external entity registration (survives across documents)
  // -------------------------------------------------------------------------

  /**
   * Replace the full set of persistent external entities.
   * These are never wiped between documents.
   *
   * @param {Record<string, string | { regex: RegExp, val: string | Function }>} map
   */
  setExternalEntities(map) {
    this._persistentEntries = buildEntries(map);
  }

  /**
   * Add a single persistent external entity without disturbing existing ones.
   *
   * @param {string} key   — bare entity name, e.g. `'copy'`
   * @param {string} value — replacement string, e.g. `'©'`
   */
  addExternalEntity(key, value) {
    validateEntityName(key);
    if (typeof value === 'string' && value.indexOf('&') === -1) {
      this._persistentEntries.push([key, {
        regex: new RegExp('&' + escapeForRegex(key) + ';', 'g'),
        val: value,
      }]);
    }
  }

  // -------------------------------------------------------------------------
  // Input / runtime entity registration (per document)
  // -------------------------------------------------------------------------

  /**
   * Inject DOCTYPE (input/runtime) entities for the current document.
   * These are stored separately from persistent entities and wiped on the
   * next `getInstance()` call so they never leak into subsequent documents.
   *
   * Also resets per-document expansion counters.
   *
   * @param {Record<string, string | { regx?: RegExp, regex?: RegExp, val: string | Function }>} map
   */
  addInputEntities(map) {
    this._totalExpansions = 0;
    this._expandedLength = 0;
    this._inputEntries = buildEntries(map);
  }

  // -------------------------------------------------------------------------
  // getInstance — builder factory integration point
  // -------------------------------------------------------------------------

  /**
   * Reset all per-document state (input entities + expansion counters) and
   * return `this`.
   *
   * The builder factory calls this each time it creates a new builder instance
   * so DOCTYPE entities from a previous document are never carried over.
   *
   */
  reset() {
    this._inputEntries = [];
    this._totalExpansions = 0;
    this._expandedLength = 0;
  }

  // -------------------------------------------------------------------------
  // Primary API
  // -------------------------------------------------------------------------

  /**
   * Replace all entity references in `str`.
   *
   * Processing order:
   *   1. persistent external
   *   2. input / runtime  (DOCTYPE)
   *   3. system
   *   4. default (lt/gt/apos/quot)
   *   5. amp
   *   6. postCheck hook
   *
   * @param {string} str
   * @returns {string}
   */
  replace(str) {
    if (typeof str !== 'string' || str.length === 0) return str;
    if (str.indexOf('&') === -1) return str; // fast path

    const original = str;


    // 1. Persistent external entities
    if (this._persistentEntries.length > 0) {
      str = this._applyEntries(str, this._persistentEntries, this._limitExternal);
    }

    // 2. Input / runtime entities (DOCTYPE)
    if (this._inputEntries.length > 0 && str.indexOf('&') !== -1) {
      str = this._applyEntries(str, this._inputEntries, this._limitExternal);
    }

    // 3. Default XML entities (lt / gt / apos / quot)
    if (this._defaultEntries.length > 0 && str.indexOf('&') !== -1) {
      str = this._applyEntries(str, this._defaultEntries, this._limitDefault);
    }

    // 4. System (named groups)
    if (this._systemEntries.length > 0 && str.indexOf('&') !== -1) {
      str = this._applyEntries(str, this._systemEntries, this._limitSystem);
    }

    // 5. &amp; — always last
    if (this._ampEnabled && str.indexOf('&') !== -1) {
      str = str.replace(AMP_ENTITY.regex, AMP_ENTITY.val);
    }

    // 6. postCheck
    str = this._postCheck(str, original);

    return str;
  }


  /**
   * 
   * @param {string} val 
   * @returns 
   */
  parse(val) {
    return this.replace(val);
  }
  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  _applyEntries(str, entries, track) {
    const limitExpansions = track && this._maxTotalExpansions > 0;
    const limitLength = track && this._maxExpandedLength > 0;
    const trackAny = limitExpansions || limitLength;

    for (let i = 0; i < entries.length; i++) {
      if (str.indexOf('&') === -1) break;

      const entity = entries[i][1];

      if (!trackAny) {
        str = str.replace(entity.regex, entity.val);
        continue;
      }

      if (limitExpansions && !limitLength) {
        let count = 0;
        str = str.replace(entity.regex, (...args) => {
          count++;
          return typeof entity.val === 'function' ? entity.val(...args) : entity.val;
        });
        if (count > 0) {
          this._totalExpansions += count;
          if (this._totalExpansions > this._maxTotalExpansions) {
            throw new Error(
              `[EntityReplacer] Entity expansion count limit exceeded: ` +
              `${this._totalExpansions} > ${this._maxTotalExpansions}`
            );
          }
        }
      } else if (limitLength && !limitExpansions) {
        const before = str.length;
        str = str.replace(entity.regex, entity.val);
        const delta = str.length - before;
        if (delta > 0) {
          this._expandedLength += delta;
          if (this._expandedLength > this._maxExpandedLength) {
            throw new Error(
              `[EntityReplacer] Expanded content length limit exceeded: ` +
              `${this._expandedLength} > ${this._maxExpandedLength}`
            );
          }
        }
      } else {
        const before = str.length;
        let count = 0;
        str = str.replace(entity.regex, (...args) => {
          count++;
          return typeof entity.val === 'function' ? entity.val(...args) : entity.val;
        });
        if (count > 0) {
          this._totalExpansions += count;
          if (this._totalExpansions > this._maxTotalExpansions) {
            throw new Error(
              `[EntityReplacer] Entity expansion count limit exceeded: ` +
              `${this._totalExpansions} > ${this._maxTotalExpansions}`
            );
          }
        }
        const delta = str.length - before;
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
    return str;
  }
}

// Re-export the built-in tables for advanced users who want to extend them
export { DEFAULT_XML_ENTITIES, AMP_ENTITY };
