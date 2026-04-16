# EntityDecoder

Decodes HTML/XML entity references back to plain text in a single pass. Supports named entities, numeric decimal (`&#60;`), and numeric hex (`&#x3C;`) references. Includes security controls for untrusted input and fine-grained NCR (Numeric Character Reference) policy enforcement per XML version.

## Install

```bash
npm install @nodable/entities
```

## Usage

```js
import { EntityDecoder, ALL_ENTITIES } from '@nodable/entities';

const dec = new EntityDecoder({ namedEntities: ALL_ENTITIES });
dec.decode('Hello &copy; 2024 &amp; &lt;stuff&gt;');
// → 'Hello © 2024 & <stuff>'
```

## Constructor options

| Option | Type | Default | Description |
|---|---|---|---|
| `namedEntities` | `object` | `null` | Extra named entity map merged into the base XML set (`amp gt lt quot apos`) |
| `limit` | `object` | see below | Security limits — see [Limit options](#limit-options) |
| `postCheck` | `(resolved, original) => string` | identity | Hook called with the final decoded string — return `original` to reject a decode |
| `numericAllowed` | `boolean` | `true` | Allow numeric entity decoding. When `false`, safe NCRs are left as-is; prohibited codepoints (surrogates, XML 1.0 C0, null) are still enforced per the `ncr` policy |
| `remove` | `string[]` | `[]` | Entity names to remove (replace with empty string) |
| `leave` | `string[]` | `[]` | Entity names to keep as literal (unchanged) |
| `ncr` | `object` | see below | Numeric Character Reference policy — see [NCR options](#ncr-options) |

### Limit options (`options.limit`)

| Option | Type | Default | Description |
|---|---|---|---|
| `maxTotalExpansions` | `number` | `0` | Max entity expansions per document. `0` = unlimited |
| `maxExpandedLength` | `number` | `0` | Max net character growth from expansions. `0` = unlimited |
| `applyLimitsTo` | `'external'` \| `'base'` \| `'all'` \| `string[]` | `'external'` | Which entity tiers count against the limits |

### NCR options (`options.ncr`)

| Option | Type | Default | Description |
|---|---|---|---|
| `xmlVersion` | `1.0` \| `1.1` | `1.0` | XML version governing restricted codepoint ranges |
| `onNCR` | `'allow'` \| `'leave'` \| `'remove'` \| `'throw'` | `'allow'` | Base action for all numeric references. Acts as a floor — for ranges that carry a minimum level the effective action is `max(onNCR, rangeMinimum)` |
| `nullNCR` | `'remove'` \| `'throw'` | `'remove'` | Action for U+0000 (null). `'allow'` and `'leave'` are clamped to `'remove'` since null is never safe |

Action severity order: `allow < leave < remove < throw`

#### Codepoint range minimums

| Range | Always/Version | Minimum action |
|---|---|---|
| U+0000 | always | `nullNCR` (≥ `remove`) |
| U+D800–U+DFFF (surrogates) | always | `remove` |
| U+0001–U+001F except U+0009/000A/000D | XML 1.0 only | `remove` |

In XML 1.1, C0 controls (U+0001–U+001F) are permitted when written as NCRs and are decoded normally. C1 controls (U+007F–U+009F) are decoded as-is in both versions.

## API

### `decode(str)`

Returns the decoded string. Returns `str` unchanged if no `&` is present (fast path).

```js
dec.decode('&lt;b&gt;')          // → '<b>'
dec.decode('&#60;b&#x3E;')       // → '<b>'
dec.decode('no entities here')   // → same reference, no allocation
```

Throws if a security limit or a `throw`-level NCR policy is exceeded.

### `setXmlVersion(version)`

Update the XML version used for NCR classification at runtime. Call this as soon as the document's `<?xml version="...">` declaration is parsed — the version is not always known at construction time.

```js
const dec = new EntityDecoder({ ncr: { onNCR: 'remove' } });

// later, once <?xml version="1.1"?> is parsed:
dec.setXmlVersion(1.1);
```

### `setExternalEntities(map)`

Registers persistent named entities. These survive `reset()` and are intended for long-lived document-set context (e.g. a DTD shared across files).

```js
dec.setExternalEntities({ brand: 'Acme Corp' });
dec.decode('&brand; Ltd');  // → 'Acme Corp Ltd'
```

### `addExternalEntity(key, value)`

Adds a single persistent external entity.

### `addInputEntities(map)`

Registers per-document entities (e.g. from a `<!DOCTYPE>` block). Also resets the per-document expansion counters. Wiped by `reset()`.

```js
dec.addInputEntities({ version: '1.0' });
dec.decode('v&version;');  // → 'v1.0'
```

### `reset()`

Clears input entities and resets expansion counters. Call between documents. Does **not** clear external entities or the XML version.

```js
dec.reset();
```

## Entity lookup priority

1. Input / runtime entities (`addInputEntities`)
2. Persistent external entities (`setExternalEntities`)
3. Base named map (`namedEntities` constructor option + built-in XML entities)

## Security limits

Limits guard against entity-expansion attacks (XML bomb / billion-laughs). By default only `external` and `input` tier entities are counted — base XML entities are trusted.

```js
const dec = new EntityDecoder({
  maxTotalExpansions: 1000,
  maxExpandedLength: 50_000,
  applyLimitsTo: 'external',   // only count runtime-injected entities
});
```

```js
// Limit all tiers — even built-in entities count
const strict = new EntityDecoder({
  maxTotalExpansions: 200,
  applyLimitsTo: 'all',
});
```

## NCR policy examples

```js
// Strict XML 1.0 — throw on any prohibited codepoint, remove null
const strict = new EntityDecoder({
  ncr: {
    xmlVersion: 1.0,
    onNCR: 'throw',   // C0 controls and surrogates → throw (max of throw and remove = throw)
    nullNCR: 'throw',
  },
});

// Lenient XML 1.1 — decode everything, silently remove null
const lenient = new EntityDecoder({
  ncr: {
    xmlVersion: 1.1,
    onNCR: 'allow',
    nullNCR: 'remove',
  },
});

// Leave all NCRs as-is except prohibited ones (those get removed)
const passThrough = new EntityDecoder({
  ncr: { onNCR: 'leave' },   // 'leave' < 'remove', so prohibited ranges still get removed
});

// Version set at parse time (common in document parsers)
const dec = new EntityDecoder({ ncr: { onNCR: 'remove' } });
// ... parser reads <?xml version="1.1"?> ...
dec.setXmlVersion(1.1);
```

## Named entity sets

Pre-built sets are exported from the package:

| Export | Contents |
|---|---|
| `XML` | `amp gt lt quot apos` |
| `COMMON_HTML` | `nbsp copy reg trade mdash ndash hellip` … |
| `CURRENCY` | `cent pound yen euro inr` … |
| `MATH` | `times divide plusmn minus ne le ge` … |
| `ARROWS` | `rarr larr harr uarr darr rArr` … |
| `ALL_ENTITIES` | All 2000+ entities |

```js
import { EntityDecoder, COMMON_HTML, CURRENCY } from '@nodable/entities';

const dec = new EntityDecoder({ namedEntities: { ...COMMON_HTML, ...CURRENCY } });
```

## Performance

~5.2 million decodes/second on a commodity laptop — ~3× faster than the `entities` npm package (see benchmark in repo root).


---

# NCR (Numeric Character Reference)

Represent a specific character from the Universal Character Set (UCS/Unicode). They are particularly useful for displaying characters that cannot be typed directly on a keyboard or characters that would otherwise be interpreted as code (like using `&#60;` for the `<` symbol).

An NCR can be written in two formats:

- Decimal: `&#[decimal];` (e.g., `&#160`; for a non-breaking space).
- Hexadecimal: `&#x[hex]; `(e.g., `&#xA0;` for the same space).

## Range of NCRs

The theoretical range for NCRs covers the entire Unicode space, from **U+0000** to **U+10FFFF**. However, not every value in this range is a "legal" character.

- **Total Range:** 0 to 1,114,111 (decimal).
- **Surrogate Pairs:** The range `U+D800` to `U+DFFF` is reserved for UTF-16 surrogate pairs and is generally prohibited as standalone NCRs.
- **Non-characters:** Certain values (ending in `FFFE` or `FFFF`) are reserved and should not be used for data exchange.

## Handling in XML 1.0 vs. XML 1.1

### 1. XML 1.0 (The Strict Standard)

XML 1.0 is quite restrictive regarding "Control Characters."
- **Prohibited Characters:** Most C0 control characters (range `U+0000` to `U+001F`) are strictly forbidden, even if you try to escape them using an NCR. For example, `&#x07;` (a bell sound) will cause a well-formedness error in an XML 1.0 parser.
- **Allowed Exceptions:** Only the carriage return (`&#x0D;`), line feed (`&#x0A;`), and horizontal tab (`&#x09;`) are permitted.

### 2. XML 1.1 (The Inclusive Standard)

XML 1.1 was designed to be more "robust" by allowing almost any Unicode character to be represented via NCR.
- **Expanded Support:** It allows the use of control characters that were previously banned in 1.0.
- **Requirement:** While these characters are allowed, they **must** be represented as NCRs (e.g., you still can't type a "null" character directly, but you can use `&#x00;` in some contexts, though `U+0000` remains controversial and often restricted even in 1.1).
- **C1 Controls:** Characters in the `U+0080` to `U+009F` range must also be escaped as NCRs in 1.1 for clarity and compatibility.

## Install

```bash
npm install @nodable/entities
```

## Usage

```js
import { EntityDecoder, ALL_ENTITIES } from '@nodable/entities';

const dec = new EntityDecoder({ namedEntities: ALL_ENTITIES });
dec.decode('Hello &copy; 2024 &amp; &lt;stuff&gt;');
// → 'Hello © 2024 & <stuff>'
```

## Constructor options

| Option | Type | Default | Description |
|---|---|---|---|
| `namedEntities` | `object` | `null` | Extra named entity map merged into the base XML set (`amp gt lt quot apos`) |
| `maxTotalExpansions` | `number` | `0` | Max entity expansions per document. `0` = unlimited |
| `maxExpandedLength` | `number` | `0` | Max net character growth from expansions. `0` = unlimited |
| `applyLimitsTo` | `'external'` \| `'base'` \| `'all'` \| `string[]` | `'external'` | Which entity tiers count against the limits |
| `postCheck` | `(resolved, original) => string` | identity | Hook called with the final decoded string — return `original` to reject a decode |
| `numericAllowed` | `boolean` | `true` | Allow numeric entities decoding |
| `remove` | `string[]` | `[]` | Entity names to remove (replace with empty string) |
| `leave` | `string[]` | `[]` | Entity names to keep as literal (unchanged) |

## API

### `decode(str)`

Returns the decoded string. Returns `str` unchanged if no `&` is present (fast path).

```js
dec.decode('&lt;b&gt;')          // → '<b>'
dec.decode('&#60;b&#x3E;')       // → '<b>'
dec.decode('no entities here')   // → same reference, no allocation
```

Throws if a security limit is exceeded.

### `setExternalEntities(map)`

Registers persistent named entities. These survive `reset()` and are intended for long-lived document-set context (e.g. a DTD shared across files).

```js
dec.setExternalEntities({ brand: 'Acme Corp' });
dec.decode('&brand; Ltd');  // → 'Acme Corp Ltd'
```

### `addExternalEntity(key, value)`

Adds a single persistent external entity.

### `addInputEntities(map)`

Registers per-document entities (e.g. from a `<!DOCTYPE>` block). Also resets the per-document expansion counters. Wiped by `reset()`.

```js
dec.addInputEntities({ version: '1.0' });
dec.decode('v&version;');  // → 'v1.0'
```

### `reset()`

Clears input entities and resets expansion counters. Call between documents. Does **not** clear external entities.

```js
dec.reset();
```

## Entity lookup priority

1. Input / runtime entities (`addInputEntities`)
2. Persistent external entities (`setExternalEntities`)
3. Base named map (`namedEntities` constructor option + built-in XML entities)

## Security limits

Limits guard against entity-expansion attacks (XML bomb / billion-laughs). By default only `external` and `input` tier entities are counted — base XML entities are trusted.

```js
const dec = new EntityDecoder({
  maxTotalExpansions: 1000,
  maxExpandedLength: 50_000,
  applyLimitsTo: 'external',   // only count runtime-injected entities
});
```

```js
// Limit all tiers — even built-in entities count
const strict = new EntityDecoder({
  maxTotalExpansions: 200,
  applyLimitsTo: 'all',
});
```

## Named entity sets

Pre-built sets are exported from the package:

| Export | Contents |
|---|---|
| `XML` | `amp gt lt quot apos` |
| `COMMON_HTML` | `nbsp copy reg trade mdash ndash hellip` … |
| `CURRENCY` | `cent pound yen euro inr` … |
| `MATH` | `times divide plusmn minus ne le ge` … |
| `ARROWS` | `rarr larr harr uarr darr rArr` … |
| `ALL_ENTITIES` | All 2000+ entities |

```js
import { EntityDecoder, COMMON_HTML, CURRENCY } from '@nodable/entities';

const dec = new EntityDecoder({ namedEntities: { ...COMMON_HTML, ...CURRENCY } });
```

## Performance

~5.2 million decodes/second on a commodity laptop — ~3× faster than the `entities` npm package (see benchmark in repo root).


---

# NCR(Numeric Character Reference)

Represent a specific character from the Universal Character Set (UCS/Unicode). They are particularly useful for displaying characters that cannot be typed directly on a keyboard or characters that would otherwise be interpreted as code (like using `&#60;` for the `<` symbol).

An NCR can be written in two formats:

- Decimal: `&#[decimal];` (e.g., `&#160`; for a non-breaking space).
- Hexadecimal: `&#x[hex]; `(e.g., `&#xA0;` for the same space).

## Range of NCRs

The theoretical range for NCRs covers the entire Unicode space, from **U+0000** to **U+10FFFF**. However, not every value in this range is a "legal" character.

- **Total Range:** 0 to 1,114,111 (decimal).
- **Surrogate Pairs:** The range `U+D800` to `U+DFFF` is reserved for UTF-16 surrogate pairs and is generally prohibited as standalone NCRs.
- **Non-characters:** Certain values (ending in `FFFE` or `FFFF`) are reserved and should not be used for data exchange.

## Handling in XML 1.0 vs. XML 1.1

### 1. XML 1.0 (The Strict Standard)

XML 1.0 is quite restrictive regarding "Control Characters."
- **Prohibited Characters:** Most C0 control characters (range `U+0000` to `U+001F`) are strictly forbidden, even if you try to escape them using an NCR. For example, `&#x07;` (a bell sound) will cause a well-formedness error in an XML 1.0 parser.
- **Allowed Exceptions:** Only the carriage return (`&#x0D;`), line feed (`&#x0A;`), and horizontal tab (`&#x09;`) are permitted.

### 2. XML 1.1 (The Inclusive Standard)

XML 1.1 was designed to be more "robust" by allowing almost any Unicode character to be represented via NCR.
- **Expanded Support:** It allows the use of control characters that were previously banned in 1.0.
- **Requirement:** While these characters are allowed, they **must** be represented as NCRs (e.g., you still can't type a "null" character directly, but you can use `&#x00;` in some contexts, though `U+0000` remains controversial and often restricted even in 1.1).
- **C1 Controls:** Characters in the `U+0080` to `U+009F` range must also be escaped as NCRs in 1.1 for clarity and compatibility.