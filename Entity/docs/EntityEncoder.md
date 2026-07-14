# EntityEncoder

Encodes plain text into HTML/XML entity references in a single pass. Uses a pre‑built integer‑keyed trie for non‑ASCII lookup — no regex, no string allocation during the scan.

## Install

```bash
npm install @nodable/entities
```

## Usage

**v3 requires an explicit entity set when encoding named (non‑ASCII) characters.**  
If you only need XML‑safe escaping (`&`, `<`, `>`, `"`, `'`), disable named‑entity encoding entirely:

```js
import { EntityEncoder } from '@nodable/entities';

// Only XML‑unsafe characters are encoded – non‑ASCII are left as‑is
const enc = new EntityEncoder({ encodeAllNamed: false });
enc.encode('© <stuff>'); // → '© &lt;stuff&gt;'
```

To encode non‑ASCII characters (like `©`, `®`, `€`) as named entities, pass a set of entity mappings:

```js
import { EntityEncoder, ALL_ENTITIES } from '@nodable/entities';

const enc = new EntityEncoder({ namedEntities: ALL_ENTITIES });
enc.encode('Hello © 2024 & <stuff>');
// → 'Hello &copy; 2024 &amp; &lt;stuff&gt;'
```

If you only need a subset (e.g. common HTML and currency), import just those:

```js
import { EntityEncoder, COMMON_HTML, CURRENCY } from '@nodable/entities';

const enc = new EntityEncoder({
  namedEntities: { ...COMMON_HTML, ...CURRENCY }
});
enc.encode('Price: 10 € © 2024'); // → 'Price: 10 &euro; &copy; 2024'
```

## Constructor options

| Option | Type | Default | Description |
|---|---|---|---|
| `namedEntities` | `Record<string, string>` | **required** (if `encodeAllNamed` is `true`) | A mapping of character sequences to entity names. The encoder will replace any character that appears as a key in this map with the corresponding `&name;`.<br><br>**Important:** There is no built‑in fallback set. You must explicitly pass the set you need. See [Entity sets](#entity-sets) below for pre‑built exports. |
| `encodeXmlSafe` | `boolean` | `true` | Encode XML‑unsafe characters `&`, `<`, `>`, `"`, `'` as `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`. This is independent of `namedEntities`. |
| `encodeAllNamed` | `boolean` | `true` | Enable non‑ASCII named‑entity encoding. If `true` and no `namedEntities` is provided, the constructor **throws**.<br><br>Set to `false` if you only want XML‑safe escaping. |
| `maxReplacements` | `number` | `0` | Stop encoding after this many replacements (across all `encode()` calls). `0` = unlimited. Use `reset()` to reset the counter. |

> **Note:** `namedEntities` is only used when `encodeAllNamed` is `true`. If you set `encodeAllNamed: false`, you can omit `namedEntities` entirely.

## API

### `encode(str)`

Returns the encoded string. Returns `str` unchanged if it contains no characters that require encoding (fast path — no allocation).

```js
const enc = new EntityEncoder({ namedEntities: ALL_ENTITIES });

enc.encode('safe text')          // → 'safe text'  (same reference)
enc.encode('Tom & Jerry')        // → 'Tom &amp; Jerry'
enc.encode('© 2024')             // → '&copy; 2024'
enc.encode('<p class="x">hi</p>')// → '&lt;p class=&quot;x&quot;&gt;hi&lt;/p&gt;'
```

### `reset()`

Resets `replacementsCount` to zero. Call between documents when using `maxReplacements`.

```js
enc.reset();
enc.replacementsCount; // → 0
```

## Entity sets

Pre‑built entity maps are exported from the package for convenience:

| Export | Contents |
|---|---|
| `XML` | `amp gt lt quot apos` (only 5) |
| `COMMON_HTML` | `nbsp copy reg trade mdash ndash hellip` … |
| `CURRENCY` | `cent pound yen euro inr` … |
| `MATH` | `times divide plusmn minus ne le ge` … |
| `ARROWS` | `rarr larr harr uarr darr rArr` … |
| `ALL_ENTITIES` | All 2000+ entities (HTML5 named references) |

You can combine them:

```js
import { COMMON_HTML, CURRENCY } from '@nodable/entities';
const mySet = { ...COMMON_HTML, ...CURRENCY };
const enc = new EntityEncoder({ namedEntities: mySet });
```

## Migration from v2

In v2, `new EntityEncoder()` automatically included the full built‑in entity set.  
**In v3, this is no longer the case** – you must explicitly provide `namedEntities` or set `encodeAllNamed: false`.

| What you need | v2 code | v3 code |
|---------------|---------|---------|
| **Full built‑in set** | `new EntityEncoder()` | `import { ALL_ENTITIES } from '@nodable/entities';`<br>`new EntityEncoder({ namedEntities: ALL_ENTITIES })` |
| **Only XML‑unsafe chars** | `new EntityEncoder({ encodeAllNamed: false })` | Same – no change |
| **Custom subset** | `new EntityEncoder({ namedEntities: myMap })` | Same – now required (and your map is used) |

If you call `new EntityEncoder()` without any options (or with `encodeAllNamed` left as `true` but no `namedEntities`), you'll get a clear error:

```
[EntityEncoder] encodeAllNamed is true but no `namedEntities` was provided.
Pass a specific set (e.g. { ...COMMON_HTML, ...CURRENCY }) or the full built‑in set
via `namedEntities: ALL_ENTITIES` imported from '@nodable/entities'.
```

## Recipes

**HTML attribute value – encode everything:**
```js
import { ALL_ENTITIES } from '@nodable/entities';
const enc = new EntityEncoder({ namedEntities: ALL_ENTITIES });
const attr = enc.encode(userInput);
```

**Plain text node – skip non‑ASCII:**
```js
const enc = new EntityEncoder({ encodeXmlSafe: true, encodeAllNamed: false });
const text = enc.encode(content); // only < > & " ' encoded
```

**Rate‑limited encoding:**
```js
const enc = new EntityEncoder({ namedEntities: ALL_ENTITIES, maxReplacements: 100 });
const partial = enc.encode(largeInput); // stops after 100 substitutions
enc.reset();
```

**Custom set with only a few characters:**
```js
const enc = new EntityEncoder({
  namedEntities: { '©': 'copy', '®': 'reg' } // only those two
});
enc.encode('© 2024'); // → '&copy; 2024'
enc.encode('€'); // → '€' (no mapping)
```

## Performance

~3.3 million encodes/second on a commodity laptop (see benchmark in repo root). The trie is built once per encoder instance and reused for every `encode()` call.