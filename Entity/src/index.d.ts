// ---------------------------------------------------------------------------
// @nodable/entities — TypeScript declarations
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Entity table shape
// ---------------------------------------------------------------------------

/** A function-based entity replacement value (used for numeric refs). */
export type EntityValFn = (match: string, captured: string, ...rest: unknown[]) => string;

/** A single entity entry: a regex and its replacement value. */
export interface EntityEntry {
  regex: RegExp;
  val: string | EntityValFn;
}

/** A map of entity name → EntityEntry. */
export type EntityTable = Record<string, EntityEntry>;

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------

/**
 * Controls which entity categories count toward the expansion limits.
 *
 * - `'external'` — only untrusted / injected entities (default, safest)
 * - `'all'`      — shorthand for all categories
 * - `string[]`   — any combination of `'external'`, `'system'`, `'default'`
 */
export type ApplyLimitsTo = 'external' | 'all' | Array<'external' | 'system' | 'default'>;

/**
 * Options accepted by the `EntityReplacer` constructor.
 */
export interface EntityReplacerOptions {
  /**
   * Built-in XML entities: `&lt;` `&gt;` `&quot;` `&apos;`
   *
   * - `true`    — use built-in table (default)
   * - `false`   — disable
   * - `object`  — use a custom table instead of the built-in set
   * @default true
   */
  default?: boolean | EntityTable | null;

  /**
   * `&amp;` → `&` final pass (always processed last to prevent double-expansion).
   * @default true
   */
  amp?: boolean | null;

  /**
   * Named entity groups (system-level, trusted).
   *
   * - `false`   — disabled (default)
   * - `true`    — enables `COMMON_HTML` built-in group
   * - `object`  — use the supplied table (compose freely with exported groups)
   *
   * @example
   * import { COMMON_HTML, CURRENCY_ENTITIES } from '@nodable/entities';
   * new EntityReplacer({ system: { ...COMMON_HTML, ...CURRENCY_ENTITIES } });
   *
   * @default false
   */
  system?: boolean | EntityTable | null;

  /**
   * Maximum number of entity references expanded per document.
   * `0` means unlimited.
   * @default 0
   */
  maxTotalExpansions?: number;

  /**
   * Maximum number of characters *added* by entity expansion per document.
   * `0` means unlimited.
   * @default 0
   */
  maxExpandedLength?: number;

  /**
   * Which entity categories count toward the expansion limits.
   * @default 'external'
   */
  applyLimitsTo?: ApplyLimitsTo;

  /**
   * Hook called once on the fully resolved string (after all categories).
   *
   * - Receives `(resolved, original)` and **must return a string**.
   * - To reject expansion, return `original`.
   * - To sanitize, return a cleaned version of `resolved`.
   *
   * @example
   * postCheck: (resolved, original) =>
   *   /<[a-z]/i.test(resolved) ? original : resolved
   */
  postCheck?: ((resolved: string, original: string) => string) | null;
}

// ---------------------------------------------------------------------------
// EntityReplacer class
// ---------------------------------------------------------------------------

/**
 * Standalone, zero-dependency XML/HTML entity replacer.
 *
 * ## Entity categories and replacement order
 *
 * Entities are processed in this fixed order per `replace()` call:
 *   1. **persistent external** — set via `setExternalEntities()` / `addExternalEntity()`
 *   2. **input / runtime**    — injected via `addInputEntities()` (DOCTYPE per-document)
 *   3. **system**             — named entity groups (e.g. `COMMON_HTML`)
 *   4. **default**            — built-in XML entities (`lt`, `gt`, `apos`, `quot`)
 *   5. **amp**                — `&amp;` → `&` (always last)
 *   6. **postCheck**          — optional hook on the fully resolved string
 *
 * ## Lifecycle with `@nodable/flexible-xml-parser`
 *
 * Construct once, then let the builder factory drive the lifecycle:
 *
 * ```ts
 * const replacer = new EntityReplacer({ default: true, system: COMMON_HTML });
 * replacer.setExternalEntities({ brand: 'Acme' }); // persistent — survives all docs
 *
 * // Builder factory calls getInstance() when creating a new builder instance:
 * const instance = replacer.getInstance();
 *
 * // Builder calls addInputEntities() if the document has a DOCTYPE block:
 * instance.addInputEntities(doctypeEntities);
 *
 * // Builder calls replace() (indirectly via ValueParser) for each text node:
 * instance.replace('&brand; v&version; &lt;'); // 'Acme v1.0 <'
 * ```
 */
export default class EntityReplacer {
  constructor(options?: EntityReplacerOptions);

  // -------------------------------------------------------------------------
  // Persistent external entities (survive across documents)
  // -------------------------------------------------------------------------

  /**
   * Replace the full set of persistent external entities.
   *
   * These entities survive across all documents — they are **not** wiped by
   * `getInstance()`. Use them for caller-supplied entities that are fixed at
   * configuration time (e.g. brand names, product codes).
   *
   * Calling this a second time replaces the previous persistent entity map.
   *
   * Values containing `&` are silently skipped to prevent recursive expansion.
   *
   * @param map  Entity name → replacement string, or pre-built `{ regex, val }` object.
   */
  setExternalEntities(
    map: Record<string, string | { regex: RegExp; val: string | EntityValFn }>
  ): void;

  /**
   * Append a single persistent external entity without disturbing the rest.
   *
   * @param key    Bare entity name without `&` / `;` — e.g. `'copy'`
   * @param value  Replacement string — must not contain `&`
   * @throws if `key` contains regex-special characters
   */
  addExternalEntity(key: string, value: string): void;

  // -------------------------------------------------------------------------
  // Input / runtime entities (per document, cleared by getInstance)
  // -------------------------------------------------------------------------

  /**
   * Inject DOCTYPE (input/runtime) entities for the **current document only**.
   *
   * These are stored separately from persistent entities. They are wiped on
   * the next `getInstance()` call so they never leak into subsequent documents.
   *
   * Also resets the per-document expansion counters.
   *
   * Accepts both plain string values and `{ regx, val }` / `{ regex, val }`
   * objects as produced by `DocTypeReader`.
   *
   * @param map  Raw entity map from the DOCTYPE reader.
   */
  addInputEntities(
    map: Record<
      string,
      | string
      | { regx: RegExp; val: string | EntityValFn }
      | { regex: RegExp; val: string | EntityValFn }
    >
  ): void;

  // -------------------------------------------------------------------------
  // Builder factory integration
  // -------------------------------------------------------------------------

  /**
   * Reset all per-document state and return `this`.
   *
   * Clears:
   * - input / runtime entities (DOCTYPE)
   * - `_totalExpansions` counter
   * - `_expandedLength` counter
   *
   * Does **not** clear persistent external entities set via
   * `setExternalEntities()` / `addExternalEntity()`.
   *
   * The builder factory calls this when creating a new builder instance,
   * ensuring each document starts clean regardless of whether it has a DOCTYPE.
   *
   */
  reset(): this;

  // -------------------------------------------------------------------------
  // Primary API
  // -------------------------------------------------------------------------

  /**
   * Replace all entity references in `str`.
   * Returns `str` unchanged if it contains no `&` character (fast path).
   */
  replace(str: string): string;

  /**
   * wrapper on replace()
   */
  parse(str: string): string;
}

// ---------------------------------------------------------------------------
// EntitiesValueParser
// ---------------------------------------------------------------------------



/**
 * Raw DOCTYPE entity map shape as produced by `DocTypeReader`.
 * Values are either plain strings or `{ regx, val }` objects
 * (note: `regx`, not `regex` — matches the reader's output field name).
 */
export type DocTypeEntityMap = Record<
  string,
  | string
  | { regx: RegExp; val: string | EntityValFn }
  | { regex: RegExp; val: string | EntityValFn }
>;

/**
 * ValueParser context object passed by `@nodable/flexible-xml-parser`.
 * All fields are optional; `parse()` accepts but ignores this argument.
 */
export interface ValueParserContext {
  elementName?: string;
  elementValue?: string;
  elementType?: string;
  matcher?: unknown;
  isLeafNode?: boolean;
}

// ---------------------------------------------------------------------------
// Named entity group exports
// ---------------------------------------------------------------------------

/**
 * ~20 most commonly needed HTML named entities.
 * Includes: `&nbsp;` `&copy;` `&reg;` `&trade;` `&mdash;` `&ndash;`
 * `&hellip;` `&laquo;` `&raquo;` `&lsquo;` `&rsquo;` `&ldquo;` `&rdquo;`
 * `&bull;` `&para;` `&sect;` `&deg;` `&frac12;` `&frac14;` `&frac34;`
 */
export const COMMON_HTML: EntityTable;

/**
 * Currency symbol entities.
 * Includes: `&cent;` `&pound;` `&yen;` `&euro;` `&inr;` `&curren;` `&fnof;`
 */
export const CURRENCY_ENTITIES: EntityTable;

/**
 * Mathematical operator entities.
 * Includes: `&times;` `&divide;` `&plusmn;` `&minus;` `&sup2;` `&sup3;`
 * `&permil;` `&infin;` `&sum;` `&prod;` `&radic;` `&ne;` `&le;` `&ge;`
 */
export const MATH_ENTITIES: EntityTable;

/**
 * Arrow entities.
 * Includes: `&larr;` `&uarr;` `&rarr;` `&darr;` `&harr;`
 * and their double-stroke variants `&lArr;` `&uArr;` `&rArr;` `&dArr;` `&hArr;`
 */
export const ARROW_ENTITIES: EntityTable;

/**
 * Numeric character reference entities.
 * Handles any valid decimal `&#NNN;` and hex `&#xHH;` code point reference.
 */
export const NUMERIC_ENTITIES: EntityTable;

/** The built-in XML entity table (`lt`, `gt`, `apos`, `quot`). */
export const DEFAULT_XML_ENTITIES: EntityTable;

/** The `&amp;` entity entry used in the final expansion pass. */
export const AMP_ENTITY: EntityEntry;
