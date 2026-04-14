# `@nodable/entities`

Standalone, zero-dependency XML/HTML entity replacement with:

- **5 entity categories** processed in a fixed, predictable order
- **Persistent vs. input entity separation** — no state leaks between documents
- **`reset()`** — clean per-document reset without cloning
- **Composable named entity groups** (HTML, currency, math, arrows, numeric refs)
- **Security limits** — cap total expansions and expanded length per document
- **Granular limit targeting** — apply limits to any subset of categories
- **`postCheck` hook** — inspect or sanitize the fully resolved string

---

## Installation

```sh
npm install @nodable/entities
```

---

## Quick Start

```js
import EntityReplacer from '@nodable/entities';

const replacer = new EntityReplacer({ default: true });

replacer.replace('5 &lt; 10 &amp;&amp; x &gt; 0');
// → '5 < 10 && x > 0'
```

With named entity groups:

```js
import EntityReplacer, { COMMON_HTML, CURRENCY_ENTITIES } from '@nodable/entities';

const replacer = new EntityReplacer({
  default: true,
  system: { ...COMMON_HTML, ...CURRENCY_ENTITIES },
});

replacer.replace('&copy; 2024 &mdash; Price: &pound;9.99');
// → '© 2024 — Price: £9.99'
```

---

## Entity Categories

Entities are processed in this fixed order — not configurable:

```
persistent input/runtime → external → system → default → amp
```

### `persistent external` — Caller-supplied configuration entities

Entities set at configuration time that survive across all documents. Never wiped by `reset()`. Set via `setExternalEntities()` or `addExternalEntity()` / `addEntity()`.

```js
const replacer = new EntityReplacer({ default: true });
replacer.setExternalEntities({ brand: 'Acme Corp', product: 'Widget Pro' });
replacer.replace('&brand; makes &product;');
// → 'Acme Corp makes Widget Pro'
```

### `input / runtime` — Per-document DOCTYPE entities

Entities injected by the parser from the document's DOCTYPE block. Stored separately from persistent entities and **wiped on every `reset()` call** so they cannot leak between documents.

Set via `addInputEntities()`. Never call this manually — `BaseOutputBuilder` calls it automatically.

### `system` — Named entity groups

Opt-in. Trusted programmer-supplied groups. Compose freely:

```js
import {
  COMMON_HTML,
  CURRENCY_ENTITIES,
  MATH_ENTITIES,
  ARROW_ENTITIES,
  NUMERIC_ENTITIES,
} from '@nodable/entities';

const replacer = new EntityReplacer({
  system: { ...COMMON_HTML, ...MATH_ENTITIES },
});
```

| Group               | Contents |
|---------------------|----------|
| `COMMON_HTML`       | `&nbsp;` `&copy;` `&reg;` `&trade;` `&mdash;` `&ndash;` `&hellip;` `&laquo;` `&raquo;` `&lsquo;` `&rsquo;` `&ldquo;` `&rdquo;` `&bull;` `&para;` `&sect;` `&deg;` `&frac12;` `&frac14;` `&frac34;` |
| `CURRENCY_ENTITIES` | `&cent;` `&pound;` `&yen;` `&euro;` `&inr;` `&curren;` `&fnof;` |
| `MATH_ENTITIES`     | `&times;` `&divide;` `&plusmn;` `&minus;` `&sup2;` `&sup3;` `&permil;` `&infin;` `&sum;` `&prod;` `&radic;` `&ne;` `&le;` `&ge;` |
| `ARROW_ENTITIES`    | `&larr;` `&uarr;` `&rarr;` `&darr;` `&harr;` `&lArr;` `&uArr;` `&rArr;` `&dArr;` `&hArr;` |
| `NUMERIC_ENTITIES`  | `&#NNN;` decimal and `&#xHH;` hex refs — any valid Unicode code point |

### `default` — Built-in XML entities

Always on unless explicitly disabled.

| Entity   | Output |
|----------|--------|
| `&lt;`   | `<`    |
| `&gt;`   | `>`    |
| `&quot;` | `"`    |
| `&apos;` | `'`    |

### `amp` — Final pass

`&amp;` → `&`

Processed **after all other categories** to prevent double-expansion:
- `&amp;lt;` → `&lt;` ✓ (not `<`)
- `&amp;amp;` → `&amp;` ✓ (not `&`)

---

## Constructor API

```js
const replacer = new EntityReplacer({
  // Category toggles
  default: true,     // true (default) | false | custom EntityTable object
  amp:     true,     // true (default) | false | null
  system:  false,    // false (default) | true for COMMON_HTML | EntityTable object

  // Security limits — 0 = unlimited
  maxTotalExpansions: 0,
  maxExpandedLength:  0,

  // Which categories count against the limits
  applyLimitsTo: 'external',   // 'external' (default) | 'all' | ['external', 'system'] | ...

  // Post-processing hook — fires once on the fully resolved string
  postCheck: resolved => resolved,   // (resolved: string, original: string) => string
});
```

---

## EntityReplacer Instance Methods

### `replace(str)`

Replace all entity references in `str`. Returns `str` unchanged (same reference) if no `&` is present — fast path.

```js
replacer.replace('Tom &amp; Jerry &lt;cartoons&gt;');
// → 'Tom & Jerry <cartoons>'
```

### `setExternalEntities(map)`

Replace the full set of **persistent** external entities. These survive across all documents and are not cleared by `reset()`.

```js
replacer.setExternalEntities({ brand: 'Acme', year: '2025' });
```

Calling this a second time replaces the entire persistent map. Values containing `&` are silently skipped.

### `addExternalEntity(key, value)`

Append a single persistent external entity without disturbing the rest.

```js
replacer.addExternalEntity('brand', 'Acme');
replacer.addExternalEntity('year', '2025');
```

### `addInputEntities(map)`

Inject **input/runtime** (DOCTYPE) entities for the current document. These are stored separately from persistent entities and wiped on the next `reset()` call. Also resets per-document expansion counters.

```js
// Called automatically by BaseOutputBuilder — no manual wiring needed.
replacer.addInputEntities(doctypeEntityMap);
```

Values containing `&` are silently skipped. Accepts pre-built `{ regex, val }` or `{ regx, val }` objects as produced by `DocTypeReader`.

### `reset()`

Reset all per-document state and return `this`.

**Clears:**
- input/runtime entities (DOCTYPE)
- `_totalExpansions` counter
- `_expandedLength` counter

**Preserves:**
- persistent external entities set via `setExternalEntities()` / `addExternalEntity()`
- all constructor config

The builder factory calls this when creating a new builder instance, ensuring each document starts clean whether or not it has a DOCTYPE.

```js
// In a builder factory:
reset() {
  const builder = new MyBuilder(this.config);
  builder.entityParser = this.entityVP.reset();
  return builder;
}
```

---

## Document-to-Document Safety

A key design goal is that entities from one document never bleed into the next. Here's how the two categories work together:

```
Document 1 parse:
  factory.reset()           → evp.reset()  [clears input, resets counters]
  builder sees DOCTYPE            → evp.addInputEntities({ version: '1.0' })
  builder processes values        → evp.parse('&brand; v&version;') → 'Acme v1.0'

Document 2 parse (no DOCTYPE):
  factory.reset()           → evp.reset()  [clears &version;, resets counters]
  no DOCTYPE                      → addInputEntities() not called
  builder processes values        → evp.parse('&brand; v&version;') → 'Acme v&version;'
                                    ↑ persistent &brand; works
                                                 ↑ &version; is gone — correct
```

---

## Security Controls

### Expansion count limit

Caps the number of entity references that may be expanded per document.

```js
const replacer = new EntityReplacer({ maxTotalExpansions: 1000 });
```

Throws `Error` if exceeded:
> `[EntityReplacer] Entity expansion count limit exceeded: 1001 > 1000`

### Expanded length limit

Caps the total number of characters *added* by entity expansion per document.

```js
const replacer = new EntityReplacer({ maxExpandedLength: 65536 });
```

Throws `Error` if exceeded:
> `[EntityReplacer] Expanded content length limit exceeded: 65537 > 65536`

### `applyLimitsTo`

Controls which categories count against the limits.

```js
// Default — only untrusted injected entities (safest)
applyLimitsTo: 'external'

// All categories
applyLimitsTo: 'all'

// Specific combination
applyLimitsTo: ['external', 'system']
applyLimitsTo: ['external', 'default']
```

---

## `postCheck` Hook

Fires **once** on the fully resolved string, after all categories have been processed. Not called if the string is unchanged (no `&` present or no matches found).

```js
// Signature
postCheck: (resolved: string, original: string) => string
```

- `resolved` — string after all entity replacements
- `original` — the original input string before any replacement
- Must **return a string**
- To reject expansion: `return original`
- To sanitize: return a modified version of `resolved`

Examples:

```js
// Reject if expansion produces any HTML tags
postCheck: (resolved, original) =>
  /<[a-z]/i.test(resolved) ? original : resolved

// Strip all tag-like content from the result
postCheck: (resolved) =>
  resolved.replace(/<[^>]*>/g, '')
```

---

## Integration with — flex-xml-parser adapter

### Setup

```js
import EntityReplacer, { COMMON_HTML } from '@nodable/entities';

const evp = new EntityReplacer({
  system: COMMON_HTML,
  maxTotalExpansions: 500,
});

// Persistent entities — survive across all documents:
evp.setExternalEntities({ brand: 'Acme', product: 'Widget' });

// Register with the builder factory:
myBuilder.registerValueParser('entity', evp);

const parser = new XMLParser({ OutputBuilder: myBuilder });
parser.parse(xml);
```

### Constructor options

All `EntityReplacerOptions` are accepted, plus one extra:

```js
new EntityReplacer({
  // All EntityReplacer options...
  default: true,
  system: COMMON_HTML,
  maxTotalExpansions: 1000,
  postCheck: (resolved, original) => resolved,

  // Extra: initial persistent entity map (same as calling setExternalEntities after construction)
  entities: { copy: '©', trade: '™', brand: 'Acme Corp' },
})
```

### `reset()` — called by builder factory

Reset per-document state (input entities + counters) and return `this`. The builder factory calls this each time it creates a new builder instance.

```js
// In your CompactObjBuilderFactory.reset():
reset() {
  const builder = new CompactObjBuilder(this._config);
  // Reset EVP for the new document:
  builder.entityParser = this._entityVP.reset();
  return builder;
}
```

---

## Custom Entity Tables

Pass any plain object as `default` or `system` to replace the built-in set:

```js
const myEntities = {
  br:  { regex: /&br;/g,  val: '\n' },
  tab: { regex: /&tab;/g, val: '\t' },
};

const replacer = new EntityReplacer({ default: myEntities });
replacer.replace('line1&br;line2&tab;indented');
// → 'line1\nline2\tindented'
```

Extend the built-in tables via spreading:

```js
import { DEFAULT_XML_ENTITIES } from '@nodable/entities';

const replacer = new EntityReplacer({
  default: { ...DEFAULT_XML_ENTITIES, br: { regex: /&br;/g, val: '\n' } },
});
```

---

## Comparison with `entities` npm package

| Feature                                        | `entities` pkg    | `@nodable/entities` |
|------------------------------------------------|-------------------|---------------------|
| XML entity decoding                            | ✅                | ✅                  |
| HTML entity decoding                           | ✅ full ~2000      | ✅ grouped, composable |
| Numeric refs with leading zeros                | ✅                | ✅                  |
| DOCTYPE / external entity injection            | ❌                | ✅                  |
| Persistent vs. input entity separation         | ❌                | ✅                  |
| Per-document reset via `reset()`         | ❌                | ✅                  |
| Expansion count limit                          | ❌                | ✅                  |
| Expanded length limit                          | ❌                | ✅                  |
| `applyLimitsTo` granularity                    | ❌                | ✅                  |
| `postCheck` hook                               | ❌                | ✅                  |
| Encoding / HTML escaping                       | ✅                | ❌ out of scope     |
| Zero dependencies                              | ✅                | ✅                  |

---

## TypeScript

Full TypeScript declarations are included via `index.d.ts`. No `@types/` package needed.

```ts
import EntityReplacer, {
  COMMON_HTML,
  EntityTable,
  EntityReplacerOptions,
} from '@nodable/entities';

// EntityReplacer
const opts: EntityReplacerOptions = {
  default: true,
  system: COMMON_HTML,
  maxTotalExpansions: 500,
  postCheck: (resolved, original) =>
    /<script/i.test(resolved) ? original : resolved,
};
const replacer = new EntityReplacer(opts);
replacer.setExternalEntities({ brand: 'Acme' });
replacer.reset(); // reset for new document
replacer.addInputEntities({ version: '1.0' }); // from DOCTYPE
```

## Note

This library silently skip numeric entities which are out range. For example `&#1114112;` is skipped.

## License

MIT
