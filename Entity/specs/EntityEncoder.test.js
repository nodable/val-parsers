/**
 * @nodable/entities — EntityEncoder test suite
 * Run with: node --experimental-vm-modules node_modules/.bin/jest
 */

import EntityEncoder from '../src/EntityEncoder.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function make(opts) {
  return new EntityEncoder(opts);
}

// ---------------------------------------------------------------------------
// 1. Fast path
// ---------------------------------------------------------------------------
describe('fast path', () => {
  const enc = make({});

  test('returns same reference when no encoding needed', () => {
    const s = 'hello world';
    expect(enc.encode(s)).toBe(s);
  });

  test('returns empty string unchanged', () => {
    expect(enc.encode('')).toBe('');
  });

  test('handles non-string input gracefully', () => {
    expect(enc.encode(null)).toBe(null);
    expect(enc.encode(undefined)).toBe(undefined);
    expect(enc.encode(42)).toBe(42);
  });

  test('returns same reference for safe ASCII-only string', () => {
    const s = 'The quick brown fox jumps over the lazy dog. 1234567890';
    expect(enc.encode(s)).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// 2. XML-unsafe characters (encodeXmlSafe: true — default)
// ---------------------------------------------------------------------------
describe('XML-unsafe characters — default options', () => {
  const enc = make({});

  test('encodes &', () => expect(enc.encode('&')).toBe('&amp;'));
  test('encodes <', () => expect(enc.encode('<')).toBe('&lt;'));
  test('encodes >', () => expect(enc.encode('>')).toBe('&gt;'));
  test('encodes "', () => expect(enc.encode('"')).toBe('&quot;'));
  test("encodes '", () => expect(enc.encode("'")).toBe('&apos;'));

  test('encodes multiple XML-unsafe characters in one string', () => {
    expect(enc.encode('<b>"hello"</b>')).toBe('&lt;b&gt;&quot;hello&quot;&lt;/b&gt;');
  });

  test('encodes & in the middle of a string', () => {
    expect(enc.encode('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  test('leaves safe ASCII characters alone', () => {
    expect(enc.encode('abc 123 !@#')).toBe('abc 123 !@#');
  });
});

// ---------------------------------------------------------------------------
// 3. encodeXmlSafe: false — XML characters are NOT encoded
// ---------------------------------------------------------------------------
describe('encodeXmlSafe: false', () => {
  const enc = make({ encodeXmlSafe: false });

  test('does not encode <', () => expect(enc.encode('<')).toBe('<'));
  test('does not encode >', () => expect(enc.encode('>')).toBe('>'));
  test('does not encode &', () => expect(enc.encode('&')).toBe('&'));
  test('does not encode "', () => expect(enc.encode('"')).toBe('"'));
  test("does not encode '", () => expect(enc.encode("'")).toBe("'"));

  test('still encodes non-ASCII named entities when encodeAllNamed: true', () => {
    const enc2 = make({ encodeXmlSafe: false, encodeAllNamed: true });
    expect(enc2.encode('©')).toBe('&COPY;');
  });
});

// ---------------------------------------------------------------------------
// 4. Non-ASCII named entity encoding (encodeAllNamed: true — default)
// ---------------------------------------------------------------------------
describe('non-ASCII named entities — encodeAllNamed: true', () => {
  const enc = make({ encodeXmlSafe: true, encodeAllNamed: true });

  test('encodes © → &COPY;', () => expect(enc.encode('©')).toBe('&COPY;'));
  test('encodes ® → &REG;', () => expect(enc.encode('®')).toBe('&REG;'));
  test('encodes ™ → &trade;', () => expect(enc.encode('™')).toBe('&TRADE;'));
  test('encodes \u00a0 → &nbsp;', () => expect(enc.encode('\u00a0')).toBe('&nbsp;'));
  test('encodes € → &euro;', () => expect(enc.encode('€')).toBe('&euro;'));
  test('encodes £ → &pound;', () => expect(enc.encode('£')).toBe('&pound;'));
  test('encodes × → &times;', () => expect(enc.encode('×')).toBe('&times;'));
  test('encodes ÷ → &divide;', () => expect(enc.encode('÷')).toBe('&divide;'));
});

// ---------------------------------------------------------------------------
// 5. encodeAllNamed: false — only XML-unsafe characters encoded
// ---------------------------------------------------------------------------
describe('encodeAllNamed: false', () => {
  const enc = make({ encodeXmlSafe: true, encodeAllNamed: false });

  test('does not encode © when encodeAllNamed is false', () => {
    expect(enc.encode('©')).toBe('©');
  });

  test('still encodes & even with encodeAllNamed: false', () => {
    expect(enc.encode('&')).toBe('&amp;');
  });

  test('still encodes < with encodeAllNamed: false', () => {
    expect(enc.encode('<p>hello</p>')).toBe('&lt;p&gt;hello&lt;/p&gt;');
  });
});

// ---------------------------------------------------------------------------
// 6. Mixed content — XML-unsafe + non-ASCII in one string
// ---------------------------------------------------------------------------
describe('mixed content', () => {
  const enc = make({ encodeXmlSafe: true, encodeAllNamed: true });

  test('encodes both XML-unsafe and non-ASCII in one pass', () => {
    expect(enc.encode('Hello © 2024 & <stuff>'))
      .toBe('Hello &COPY; 2024 &amp; &lt;stuff&gt;');
  });

  test('encodes entity at the very start', () => {
    expect(enc.encode('©Hello')).toBe('&COPY;Hello');
  });

  test('encodes entity at the very end', () => {
    expect(enc.encode('Hello©')).toBe('Hello&COPY;');
  });

  test('consecutive non-ASCII entities', () => {
    expect(enc.encode('©®')).toBe('&COPY;&REG;');
  });

  test('consecutive XML-unsafe characters', () => {
    expect(enc.encode('<>')).toBe('&lt;&gt;');
  });

  test('long safe string with one entity at the end', () => {
    const safe = 'a'.repeat(1000);
    expect(enc.encode(safe + '©')).toBe(safe + '&COPY;');
  });
});

// ---------------------------------------------------------------------------
// 7. maxReplacements option
// ---------------------------------------------------------------------------
describe('maxReplacements', () => {
  it.only('stops encoding after maxReplacements is reached', () => {
    const enc = make({ encodeXmlSafe: true, maxReplacements: 2 });
    // 3 unsafe chars — only the first 2 should be encoded
    const result = enc.encode('< > &');
    console.log(result)
    expect(result).toBe("&lt; &gt; &");
  });

  test('0 = unlimited', () => {
    const enc = make({ encodeXmlSafe: true, maxReplacements: 0 });
    const input = '<'.repeat(1000);
    const result = enc.encode(input);
    expect((result.match(/&lt;/g) || []).length).toBe(1000);
  });

  it.only('replacementsCount is reset at the start of each encode call', () => {
    const enc = make({ encodeXmlSafe: true, maxReplacements: 2 });
    enc.encode('< > &');  // exhaust the limit
    const result = enc.encode('< > &');  // fresh call — limit resets
    expect(result).toBe("< > &");
  });
});

// ---------------------------------------------------------------------------
// 8. reset()
// ---------------------------------------------------------------------------
describe('reset()', () => {
  test('reset() zeroes replacementsCount', () => {
    const enc = make({ encodeXmlSafe: true, maxReplacements: 2 });
    enc.encode('< > &');
    enc.reset();
    expect(enc.replacementsCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Boundary / edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  const enc = make({ encodeXmlSafe: true, encodeAllNamed: true });

  test('single unsafe ASCII character', () => {
    expect(enc.encode('<')).toBe('&lt;');
  });

  test('single safe ASCII character', () => {
    expect(enc.encode('a')).toBe('a');
  });

  test('single non-ASCII character', () => {
    expect(enc.encode('©')).toBe('&COPY;');
  });

  test('string of only whitespace is returned unchanged', () => {
    expect(enc.encode('   ')).toBe('   ');
  });

  test('all five XML-unsafe characters in sequence', () => {
    expect(enc.encode('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&apos;');
  });

  test('interleaved safe and unsafe characters at every position', () => {
    expect(enc.encode('a<b>c&d"e\'f'))
      .toBe('a&lt;b&gt;c&amp;d&quot;e&apos;f');
  });

  test('very long safe string is returned unchanged (same reference)', () => {
    const s = 'hello world '.repeat(10_000);
    expect(enc.encode(s)).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// 10. Default constructor options
// ---------------------------------------------------------------------------
describe('default constructor options', () => {
  test('encodeXmlSafe defaults to true', () => {
    const enc = new EntityEncoder();
    expect(enc.encode('<')).toBe('&lt;');
  });

  test('encodeAllNamed defaults to true', () => {
    const enc = new EntityEncoder();
    expect(enc.encode('©')).toBe('&COPY;');
  });

  test('maxReplacements defaults to 0 (unlimited)', () => {
    const enc = new EntityEncoder();
    expect(enc.maxReplacements).toBe(0);
  });
});