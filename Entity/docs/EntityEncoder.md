# EntityEncoder

Encodes plain text into HTML/XML entity references in a single pass. Uses a pre-built integer-keyed trie for non-ASCII lookup — no regex, no string allocation during the scan.

## Install

```bash
npm install @nodable/entities
```

## Usage

```js
import { EntityEncoder } from '@nodable/entities';

const enc = new EntityEncoder();
enc.encode('Hello © 2024 & <stuff>');
// → 'Hello &copy; 2024 &amp; &lt;stuff&gt;'
```

## Constructor options

| Option | Type | Default | Description |
|---|---|---|---|
| `encodeXmlSafe` | `boolean` | `true` | Encode `& < > " '` as named XML entities |
| `encodeAllNamed` | `boolean` | `true` | Encode non-ASCII characters that have a named HTML entity (©, ®, ™, €, …) |
| `maxReplacements` | `number` | `0` | Stop encoding after this many replacements. `0` = unlimited |

## API

### `encode(str)`

Returns the encoded string. Returns `str` unchanged if it contains no characters that require encoding (fast path — no allocation).

```js
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

## Recipes

**HTML attribute value — encode everything:**
```js
const enc = new EntityEncoder({ encodeXmlSafe: true, encodeAllNamed: true });
const attr = enc.encode(userInput);
```

**Plain text node — skip non-ASCII:**
```js
const enc = new EntityEncoder({ encodeXmlSafe: true, encodeAllNamed: false });
const text = enc.encode(content); // only < > & " ' encoded
```

**Rate-limited encoding:**
```js
const enc = new EntityEncoder({ maxReplacements: 100 });
const partial = enc.encode(largeInput); // stops after 100 substitutions
enc.reset();
```

## Performance

~3.3 million encodes/second on a commodity laptop (see benchmark in repo root).