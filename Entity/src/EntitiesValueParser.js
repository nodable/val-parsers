import EntityReplacer from './EntityReplacer.js';

/**
 * EntitiesValueParser — value-parser adapter that wraps `EntityReplacer`.
 *
 * Register an instance under the key `'entity'` on a `@nodable/flexible-xml-parser`
 * output builder factory to enable entity expansion for all parsed text values.
 *
 * ## Lifecycle
 *
 * 1. **Construction** — supply configuration and optional persistent entities.
 * 2. **`setExternalEntities(map)`** — (re)set the full persistent entity map.
 *    Or use `addEntity(key, value)` to add one at a time.
 * 3. **`getInstance()`** — builder factory calls this when creating a new builder
 *    instance. Resets input entities and per-document counters. Returns `this`.
 * 4. **`addInputEntities(map)`** — builder calls this if the document has a
 *    DOCTYPE block. Stores entities for *this document only*.
 * 5. **`parse(val)`** — called by the builder for each text value.
 *
 * ```js
 * const evp = new EntitiesValueParser({ system: COMMON_HTML });
 * evp.setExternalEntities({ brand: 'Acme' });
 * builder.registerValueParser('entity', evp);
 * ```
 *
 * -------------------------------------------------------------------------
 * Constructor options (all optional)
 * -------------------------------------------------------------------------
 *
 * `default`             — `true` (default) | `false`/`null` | custom EntityTable
 * `system`              — `false` (default) | `true` for COMMON_HTML | EntityTable
 * `amp`                 — `true` (default) | `false`/`null`
 * `maxTotalExpansions`  — max entity refs expanded per document (0 = unlimited)
 * `maxExpandedLength`   — max characters added by expansion per document (0 = unlimited)
 * `applyLimitsTo`       — which categories count toward limits (default: `'external'`)
 * `postCheck`           — `(resolved, original) => string` hook
 * `entities`            — initial persistent entity map, e.g. `{ copy: '©' }`
 */
export default class EntitiesValueParser {
  constructor(options = {}) {
    this._replacer = new EntityReplacer(options);

    // Load any entities provided inline at construction time as persistent entities
    if (options.entities && typeof options.entities === 'object') {
      const init = {};
      for (const [key, val] of Object.entries(options.entities)) {
        this._validateEntityArgs(key, val);
        init[key] = val;
      }
      this._replacer.setExternalEntities(init);
    }
  }

  // -------------------------------------------------------------------------
  // Persistent external entity registration
  // -------------------------------------------------------------------------

  /**
   * Replace the full set of persistent external entities.
   * These survive across documents and are never wiped by `getInstance()`.
   *
   * @param {Record<string, string>} map  — e.g. `{ copy: '©', brand: 'Acme' }`
   */
  setExternalEntities(map) {
    for (const [key, val] of Object.entries(map)) {
      this._validateEntityArgs(key, val);
    }
    this._replacer.setExternalEntities(map);
  }

  /**
   * Add (or replace) a single persistent external entity.
   * Existing persistent entities are preserved.
   *
   * @param {string} key   — bare name without `&` / `;`, e.g. `'copy'`
   * @param {string} value — replacement string, e.g. `'©'`
   */
  addEntity(key, value) {
    this._validateEntityArgs(key, value);
    this._replacer.addExternalEntity(key, value);
  }

  // -------------------------------------------------------------------------
  // Builder factory integration
  // -------------------------------------------------------------------------

  /**
   * Reset per-document state (input entities + expansion counters) and return `this`.
   *
   * The builder factory calls this when creating a new builder instance so that
   * DOCTYPE entities from a previous document are never carried over.
   *
   * @returns {EntitiesValueParser} `this`
   */
  getInstance() {
    this._replacer.getInstance();
    return this;
  }

  // -------------------------------------------------------------------------
  // DOCTYPE integration — called by BaseOutputBuilder
  // -------------------------------------------------------------------------

  /**
   * Receive DOCTYPE entities from the output builder.
   *
   * These are stored separately from persistent entities and wiped on the next
   * `getInstance()` call. Resets per-document expansion counters.
   *
   * @param {Record<string, string | { regx: RegExp, val: string | Function }>} entities
   *   Raw entity map from `DocTypeReader` — values may be plain strings or
   *   `{ regx, val }` objects (note: `regx`, not `regex`, matching the reader's output).
   */
  addInputEntities(entities) {
    this._replacer.addInputEntities(entities);
  }

  // -------------------------------------------------------------------------
  // ValueParser interface
  // -------------------------------------------------------------------------

  /**
   * Replace entity references in `val`.
   *
   * @param {string} val
   * @param {object} [_context]
   * @returns {string}
   */
  parse(val, _context) {
    if (typeof val !== 'string') return val;
    return this._replacer.replace(val);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  _validateEntityArgs(key, value) {
    if (typeof key !== 'string' || key.includes('&') || key.includes(';')) {
      throw new Error(
        `[EntitiesValueParser] Entity key must not contain '&' or ';'. ` +
        `Use 'copy' for '&copy;', got: ${JSON.stringify(key)}`
      );
    }
    if (typeof value !== 'string' || value.includes('&')) {
      throw new Error(
        `[EntitiesValueParser] Entity value must be a plain string that does not ` +
        `contain '&', got: ${JSON.stringify(value)}`
      );
    }
  }
}
