# EntityDecoder

Decodes HTML/XML entity references back to plain text in a single pass. Supports named entities, numeric decimal (`&#60;`), and numeric hex (`&#x3C;`) references. Includes security controls for untrusted input.

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