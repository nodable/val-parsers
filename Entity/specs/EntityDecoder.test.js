/**
 * @nodable/entities — test suite
 * Run with: node --experimental-vm-modules node_modules/.bin/jest
 */

import EntityDecoder from '../src/EntityDecoder.js';

import {
  COMMON_HTML,
  CURRENCY,
  MATH,
  ARROWS,
  XML as XML_ENTITIES
} from '../src/entities.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function make(opts) {
  return new EntityDecoder(opts);
}

// ---------------------------------------------------------------------------
// 1. Fast path
// ---------------------------------------------------------------------------
describe('fast path — no & in string', () => {
  const r = make({});

  test('returns same reference when no & present', () => {
    const s = 'hello world';
    expect(r.decode(s)).toBe(s);
  });

  test('returns empty string unchanged', () => {
    expect(r.decode('')).toBe('');
  });

  test('handles non-string input gracefully', () => {
    expect(r.decode(null)).toBe(null);
    expect(r.decode(undefined)).toBe(undefined);
    expect(r.decode(42)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// 2. Built-in XML entities (always active via XML_ENTITIES in base map)
// ---------------------------------------------------------------------------
describe('built-in XML entities', () => {
  const r = make({});

  test('replaces &lt;', () => expect(r.decode('&lt;')).toBe('<'));
  test('replaces &gt;', () => expect(r.decode('&gt;')).toBe('>'));
  test('replaces &quot;', () => expect(r.decode('&quot;')).toBe('"'));
  test('replaces &apos;', () => expect(r.decode('&apos;')).toBe("'"));
  test('replaces &amp;', () => expect(r.decode('&amp;')).toBe('&'));

  test('replaces multiple in one string', () => {
    expect(r.decode('a &lt; b &gt; c')).toBe('a < b > c');
  });

  test('&amp;lt; does not double-expand — single pass resolves left-to-right', () => {
    // Scanner hits &amp; first → '&', then continues from 'lt;' which has
    // no leading '&', so it is emitted literally. Result: '&lt;', not '<'.
    expect(r.decode('&amp;lt;')).toBe('&lt;');
  });

  test('&amp;amp; resolves to &amp;, not &', () => {
    expect(r.decode('&amp;amp;')).toBe('&amp;');
  });

  test('decimal numeric ref &#60; → <', () => {
    expect(r.decode('&#60;')).toBe('<');
  });

  test('hex numeric ref &#x3E; → >', () => {
    expect(r.decode('&#x3E;')).toBe('>');
  });

  test('decimal numeric ref &#60; → <', () => {
    const r = make({ numericAllowed: false });
    expect(r.decode('&#60;')).toBe('&#60;');
  });

  test('hex numeric ref &#x3E; → >', () => {
    const r = make({ numericAllowed: false });
    expect(r.decode('&#x3E;')).toBe('&#x3E;');
  });
});

// ---------------------------------------------------------------------------
// 3. namedEntities — extending the base map
// ---------------------------------------------------------------------------
describe('namedEntities option', () => {
  test('entities in namedEntities are resolved', () => {
    const r = make({ namedEntities: { foo: 'BAR' } });
    expect(r.decode('&foo;')).toBe('BAR');
  });

  test('XML_ENTITIES remain active when namedEntities is set', () => {
    const r = make({ namedEntities: { foo: 'BAR' } });
    expect(r.decode('&lt;')).toBe('<');
  });

  test('namedEntities can override XML_ENTITIES', () => {
    const r = make({ namedEntities: { lt: 'LESSTHAN' } });
    expect(r.decode('&lt;')).toBe('LESSTHAN');
  });

  test('accepts legacy { regex, val } objects in namedEntities', () => {
    const r = make({ namedEntities: { br: { regex: /&br;/g, val: '\n' } } });
    expect(r.decode('line1&br;line2')).toBe('line1\nline2');
  });
});

// ---------------------------------------------------------------------------
// 4. Named entity groups via namedEntities
// ---------------------------------------------------------------------------
describe('COMMON_HTML group', () => {
  const r = make({ namedEntities: COMMON_HTML });

  test('&nbsp;', () => expect(r.decode('&nbsp;')).toBe('\u00a0'));
  test('&copy;', () => expect(r.decode('&copy;')).toBe('\u00a9'));
  test('&reg;', () => expect(r.decode('&reg;')).toBe('\u00ae'));
  test('&trade;', () => expect(r.decode('&trade;')).toBe('\u2122'));
  test('&mdash;', () => expect(r.decode('&mdash;')).toBe('\u2014'));
  test('&ndash;', () => expect(r.decode('&ndash;')).toBe('\u2013'));
  test('&hellip;', () => expect(r.decode('&hellip;')).toBe('\u2026'));
});

describe('CURRENCY group', () => {
  const r = make({ namedEntities: CURRENCY });

  test('&cent;', () => expect(r.decode('&cent;')).toBe('\u00a2'));
  test('&pound;', () => expect(r.decode('&pound;')).toBe('\u00a3'));
  test('&yen;', () => expect(r.decode('&yen;')).toBe('\u00a5'));
  test('&euro;', () => expect(r.decode('&euro;')).toBe('\u20ac'));
  test('&inr;', () => expect(r.decode('&inr;')).toBe('\u20b9'));
});

describe('MATH group', () => {
  const r = make({ namedEntities: MATH });

  test('&times;', () => expect(r.decode('&times;')).toBe('\u00d7'));
  test('&divide;', () => expect(r.decode('&divide;')).toBe('\u00f7'));
  test('&plusmn;', () => expect(r.decode('&plusmn;')).toBe('\u00b1'));
  test('&minus;', () => expect(r.decode('&minus;')).toBe('\u2212'));
  test('&ne;', () => expect(r.decode('&ne;')).toBe('\u2260'));
  test('&le;', () => expect(r.decode('&le;')).toBe('\u2264'));
  test('&ge;', () => expect(r.decode('&ge;')).toBe('\u2265'));
});

describe('ARROWS group', () => {
  const r = make({ namedEntities: ARROWS });

  test('&rarr;', () => expect(r.decode('&rarr;')).toBe('\u2192'));
  test('&larr;', () => expect(r.decode('&larr;')).toBe('\u2190'));
  test('&harr;', () => expect(r.decode('&harr;')).toBe('\u2194'));
  test('&uarr;', () => expect(r.decode('&uarr;')).toBe('\u2191'));
  test('&darr;', () => expect(r.decode('&darr;')).toBe('\u2193'));
  test('&rArr;', () => expect(r.decode('&rArr;')).toBe('\u21d2'));
});

describe('numeric references — native resolution', () => {
  const r = make({});

  test('decimal &#65; → A', () => expect(r.decode('&#65;')).toBe('A'));
  test('decimal with leading zeros &#0065; → A', () => expect(r.decode('&#0065;')).toBe('A'));
  test('hex &#x41; → A', () => expect(r.decode('&#x41;')).toBe('A'));
  test('hex uppercase &#X41; → A (x is case-insensitive)', () => {
    expect(r.decode('&#X41;')).toBe('A');
  });
  test('emoji via decimal &#128512;', () => expect(r.decode('&#128512;')).toBe('😀'));
  test('emoji via hex &#x1F600;', () => expect(r.decode('&#x1F600;')).toBe('😀'));
  test('decimal with many leading zeros &#00065;', () => expect(r.decode('&#00065;')).toBe('A'));
  test('hex with leading zeros &#x00041;', () => expect(r.decode('&#x00041;')).toBe('A'));
});

describe('composed namedEntities groups', () => {
  const r = make({ namedEntities: { ...COMMON_HTML, ...CURRENCY } });

  test('both groups active', () => {
    expect(r.decode('&copy; &euro;')).toBe('\u00a9 \u20ac');
  });
});

// ---------------------------------------------------------------------------
// 5. External entities — persistent and input/runtime
// ---------------------------------------------------------------------------
describe('persistent external entities (setExternalEntities)', () => {
  test('basic persistent entity', () => {
    const r = make({});
    r.setExternalEntities({ foo: 'bar' });
    expect(r.decode('&foo;')).toBe('bar');
  });
  it('numeric persistent entity', () => {
    const r = make({});
    expect(() => r.setExternalEntities({ '#xD': 'bar' })).toThrow();
  });

  test('multiple persistent entities', () => {
    const r = make({});
    r.setExternalEntities({ foo: 'FOO', baz: 'BAZ' });
    expect(r.decode('&foo; and &baz;')).toBe('FOO and BAZ');
  });

  test('entity name with dot is accepted', () => {
    const r = make({});
    r.setExternalEntities({ 'my.entity': 'VALUE' });
    expect(r.decode('&my.entity;')).toBe('VALUE');
  });

  test('accepts pre-built { regex, val } objects', () => {
    const r = make({});
    r.setExternalEntities({ custom: { regex: /&custom;/g, val: 'CUSTOM_VALUE' } });
    expect(r.decode('&custom;')).toBe('CUSTOM_VALUE');
  });

  test('throws on invalid entity name character', () => {
    const r = make({});
    expect(() => r.setExternalEntities({ 'bad&name': 'x' })).toThrow();
  });

  test('addExternalEntity appends without wiping existing entries', () => {
    const r = make({});
    r.setExternalEntities({ a: 'AAA' });
    r.addExternalEntity('b', 'BBB');
    expect(r.decode('&a; &b;')).toBe('AAA BBB');
  });

  test('persistent entities survive reset()', () => {
    const r = make({});
    r.setExternalEntities({ brand: 'Acme' });
    r.reset();
    expect(r.decode('&brand;')).toBe('Acme');
  });
});

describe('input / runtime entities (addInputEntities)', () => {
  test('basic input entity', () => {
    const r = make({});
    r.addInputEntities({ foo: 'bar' });
    expect(r.decode('&foo;')).toBe('bar');
  });

  test('accepts DocTypeReader { regx, val } objects', () => {
    const r = make({});
    r.addInputEntities({ ent: { regx: /&ent;/g, val: 'RESOLVED' } });
    expect(r.decode('&ent;')).toBe('RESOLVED');
  });

  test('addInputEntities resets counters', () => {
    const r = make({ maxTotalExpansions: 5, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    r.decode('&x;&x;&x;'); // 3 expansions
    r.addInputEntities({ x: 'X' }); // resets counter
    expect(() => r.decode('&x;&x;&x;&x;&x;')).not.toThrow(); // exactly 5 — ok
  });

  test('reset() wipes input entities', () => {
    const r = make({});
    r.addInputEntities({ docEnt: 'VALUE' });
    expect(r.decode('&docEnt;')).toBe('VALUE');
    r.reset();
    expect(r.decode('&docEnt;')).toBe('&docEnt;');
  });

  test('input entities do not bleed across documents', () => {
    const r = make({});
    r.addInputEntities({ tmp: 'DOC1' });
    r.reset(); // second document has no DOCTYPE
    expect(r.decode('&tmp;')).toBe('&tmp;');
  });
});

describe('entity priority order', () => {
  test('input beats external when both define the same name', () => {
    const r = make({});
    r.setExternalEntities({ ent: 'EXTERNAL' });
    r.addInputEntities({ ent: 'INPUT' });
    expect(r.decode('&ent;')).toBe('INPUT');
  });

  test('external beats base when both define the same name', () => {
    const r = make({});
    r.setExternalEntities({ lt: 'LESSTHAN' });
    expect(r.decode('&lt;')).toBe('LESSTHAN');
  });

  test('base is used when neither input nor external defines the name', () => {
    const r = make({});
    expect(r.decode('&lt;')).toBe('<');
  });
});

// ---------------------------------------------------------------------------
// 6. Security limits
// ---------------------------------------------------------------------------
describe('maxTotalExpansions', () => {
  test('throws when limit exceeded (external tier)', () => {
    const r = make({ maxTotalExpansions: 3, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    expect(() => r.decode('&x;&x;&x;&x;')).toThrow(/expansion count limit/);
  });

  test('does not throw when exactly at limit', () => {
    const r = make({ maxTotalExpansions: 3, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    expect(() => r.decode('&x;&x;&x;')).not.toThrow();
  });

  test('0 = unlimited', () => {
    const r = make({ maxTotalExpansions: 0, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    const big = '&x;'.repeat(10_000);
    expect(() => r.decode(big)).not.toThrow();
  });

  test('Infinity = unlimited', () => {
    const r = make({ maxTotalExpansions: Infinity, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    const big = '&x;'.repeat(10_000);
    expect(() => r.decode(big)).not.toThrow();
  });

  test('base entities not tracked when applyLimitsTo: external', () => {
    const r = make({ maxTotalExpansions: 1, applyLimitsTo: 'external' });
    // Many base-tier expansions — should NOT throw
    expect(() => r.decode('&lt;&gt;&lt;&gt;&lt;&gt;')).not.toThrow();
  });

  test('base entities tracked when applyLimitsTo: base', () => {
    const r = make({ maxTotalExpansions: 2, applyLimitsTo: 'base' });
    expect(() => r.decode('&lt;&gt;&lt;')).toThrow(/expansion count limit/);
  });

  test('base entities tracked when applyLimitsTo: all', () => {
    const r = make({ maxTotalExpansions: 2, applyLimitsTo: 'all' });
    expect(() => r.decode('&lt;&gt;&lt;')).toThrow(/expansion count limit/);
  });

  test('namedEntities group tracked when applyLimitsTo: base', () => {
    const r = make({
      namedEntities: COMMON_HTML,
      maxTotalExpansions: 2,
      applyLimitsTo: 'base',
    });
    expect(() => r.decode('&copy;&copy;&copy;')).toThrow(/expansion count limit/);
  });
});

describe('maxExpandedLength', () => {
  test('throws when expanded length exceeded', () => {
    // &x; (3 chars) → 'XXXXXXXXXX' (10 chars) = net +7; limit is 5
    const r = make({ maxExpandedLength: 5, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'XXXXXXXXXX' });
    expect(() => r.decode('&x;')).toThrow(/length limit/);
  });

  test('does not throw when exactly at limit', () => {
    // &x; (3 chars) → 'XXXXXXXX' (8 chars) = net +5; limit is 5
    const r = make({ maxExpandedLength: 5, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'XXXXXXXX' });
    expect(() => r.decode('&x;')).not.toThrow();
  });

  test('cumulative across multiple replacements', () => {
    // &x; → 'XXXXX' = net +2 per expansion; two expansions = +4 total; limit 10
    const r = make({ maxExpandedLength: 10, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'XXXXX' });
    expect(() => r.decode('&x;&x;')).not.toThrow();
  });
});

describe('applyLimitsTo: array', () => {
  test('limits both external and base when both specified', () => {
    const r = make({
      namedEntities: COMMON_HTML,
      maxTotalExpansions: 1,
      applyLimitsTo: ['external', 'base'],
    });
    r.addInputEntities({ x: 'X' });
    // 1 external + 1 base = 2 > limit of 1
    expect(() => r.decode('&x;&copy;')).toThrow(/expansion count limit/);
  });
});

// ---------------------------------------------------------------------------
// 7. postCheck hook
// ---------------------------------------------------------------------------
describe('postCheck', () => {
  test('called with resolved and original', () => {
    let args;
    const r = make({
      postCheck: (resolved, original) => {
        args = { resolved, original };
        return resolved;
      },
    });
    r.decode('&lt;');
    expect(args.original).toBe('&lt;');
    expect(args.resolved).toBe('<');
  });

  test('returning original rejects expansion', () => {
    const r = make({
      postCheck: (resolved, original) =>
        /</.test(resolved) ? original : resolved,
    });
    expect(r.decode('&lt;')).toBe('&lt;');  // rejected
    expect(r.decode('&amp;')).toBe('&');    // allowed
  });

  test('can sanitize resolved string', () => {
    const r = make({
      postCheck: (resolved) => {
        expect(resolved).toBe('hello <script>');
        return "hello "
      },
    });

    expect(r.decode('hello &lt;script&gt;')).toBe('hello ');
  });
});

// ---------------------------------------------------------------------------
// 8. reset()
// ---------------------------------------------------------------------------
describe('reset()', () => {
  test('clears input entities', () => {
    const r = make({});
    r.addInputEntities({ tmp: 'DOC1' });
    r.reset();
    expect(r.decode('&tmp;')).toBe('&tmp;');
  });

  test('resets totalExpansions counter', () => {
    const r = make({ maxTotalExpansions: 2, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    r.decode('&x;&x;'); // exhaust counter
    r.reset();
    r.addInputEntities({ x: 'X' });
    expect(() => r.decode('&x;&x;')).not.toThrow();
  });

  test('does NOT clear persistent external entities', () => {
    const r = make({});
    r.setExternalEntities({ brand: 'Acme' });
    r.reset();
    expect(r.decode('&brand;')).toBe('Acme');
  });
});

// ---------------------------------------------------------------------------
// 9. Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  test('unknown entity is left unchanged', () => {
    const r = make({});
    expect(r.decode('&unknown;')).toBe('&unknown;');
  });

  test('partial entity ref without closing ; is left unchanged', () => {
    const r = make({});
    expect(r.decode('&lt')).toBe('&lt');
  });

  test('entity at start of string', () => {
    const r = make({});
    expect(r.decode('&lt;hello')).toBe('<hello');
  });

  test('entity at end of string', () => {
    const r = make({});
    expect(r.decode('hello&gt;')).toBe('hello>');
  });

  test('consecutive entities with no whitespace', () => {
    const r = make({});
    expect(r.decode('&lt;&gt;')).toBe('<>');
  });

  test('very long string with no entities — same reference returned', () => {
    const r = make({});
    const s = 'a'.repeat(100_000);
    expect(r.decode(s)).toBe(s);
  });

  test('lone & with no token is left unchanged', () => {
    const r = make({});
    expect(r.decode('& ')).toBe('& ');
  });

  test('numeric refs with leading zeros', () => {
    const r = make({});
    expect(r.decode('&#00065;')).toBe('A');
    expect(r.decode('&#x00041;')).toBe('A');
  });

  test('out-of-range numeric ref is left unchanged', () => {
    const r = make({});
    expect(r.decode('&#1114112;')).toBe('&#1114112;');
  });
});

// ---------------------------------------------------------------------------
// 10. Exports
// ---------------------------------------------------------------------------
describe('exports', () => {
  test('XML_ENTITIES is a plain object with expected keys', () => {
    expect(typeof XML_ENTITIES).toBe('object');
    expect(XML_ENTITIES).toHaveProperty('lt');
    expect(XML_ENTITIES).toHaveProperty('gt');
    expect(XML_ENTITIES).toHaveProperty('quot');
    expect(XML_ENTITIES).toHaveProperty('apos');
    expect(XML_ENTITIES).toHaveProperty('amp');
  });

  test('all named entity groups are plain objects', () => {
    for (const g of [COMMON_HTML, CURRENCY, MATH, ARROWS]) {
      expect(typeof g).toBe('object');
      expect(g).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Remove and Leave options
// ---------------------------------------------------------------------------
describe('remove and leave options', () => {
  test('remove: removes specified entities', () => {
    const r = make({ remove: ['nbsp', 'copy'] });
    expect(r.decode('a&nbsp;b&copy;c')).toBe('abc');
  });

  test('leave: leaves specified entities as literals', () => {
    const r = make({ leave: ['nbsp', 'copy'] });
    expect(r.decode('a&nbsp;b&copy;c')).toBe('a&nbsp;b&copy;c');
  });

  test('remove takes precedence over leave', () => {
    const r = make({ remove: ['nbsp'], leave: ['nbsp'] });
    expect(r.decode('a&nbsp;b')).toBe('ab');
  });

  test('remove applies to base entities', () => {
    const r = make({ remove: ['lt'] });
    expect(r.decode('a&lt;b')).toBe('ab');
  });

  test('leave applies to base entities', () => {
    const r = make({ leave: ['lt'] });
    expect(r.decode('a&lt;b')).toBe('a&lt;b');
  });

  test('remove applies to named entities', () => {
    const r = make({ remove: ['copy'], namedEntities: COMMON_HTML });
    expect(r.decode('a&copy;b')).toBe('ab');
  });

  test('leave applies to named entities', () => {
    const r = make({ leave: ['copy'], namedEntities: COMMON_HTML });
    expect(r.decode('a&copy;b')).toBe('a&copy;b');
  });

  test('remove applies to numeric entities', () => {
    const r = make({ remove: ['#160'] });
    expect(r.decode('a&#160;b')).toBe('ab');
  });

  test('leave applies to numeric entities', () => {
    const r = make({ leave: ['#160'] });
    expect(r.decode('a&#160;b')).toBe('a&#160;b');
  });

  test('remove applies to external entities', () => {
    const r = make({ remove: ['foo'], namedEntities: { foo: 'bar' } });
    expect(r.decode('a&foo;b')).toBe('ab');
  });

  test('leave applies to external entities', () => {
    const r = make({ leave: ['foo'], namedEntities: { foo: 'bar' } });
    expect(r.decode('a&foo;b')).toBe('a&foo;b');
  });

  test('remove applies to input entities', () => {
    const r = make({ remove: ['foo'] });
    r.addInputEntities({ foo: 'bar' });
    expect(r.decode('a&foo;b')).toBe('ab');
  });

  test('leave applies to input entities', () => {
    const r = make({ leave: ['foo'] });
    r.addInputEntities({ foo: 'bar' });
    expect(r.decode('a&foo;b')).toBe('a&foo;b');
  });

  test('remove applies to unknown entities (replaces with empty string)', () => {
    const r = make({ remove: ['unknown'] });
    expect(r.decode('a&unknown;b')).toBe('ab');
  });

  test('leave applies to unknown entities (leaves as literal)', () => {
    const r = make({ leave: ['unknown'] });
    expect(r.decode('a&unknown;b')).toBe('a&unknown;b');
  });

  test('remove and leave can be combined', () => {
    const r = make({ remove: ['nbsp'], leave: ['copy'] });
    expect(r.decode('a&nbsp;b&copy;c')).toBe('ab&copy;c');
  });

  test('remove and leave arrays can be empty', () => {
    const r = make({ remove: [], leave: [] });
    expect(r.decode('a&nbsp;b&copy;c')).toBe('a&nbsp;b&copy;c');
  });

  test('remove and leave arrays can be null/undefined (treated as empty)', () => {
    const r1 = make({ remove: null, leave: null });
    expect(r1.decode('a&nbsp;b')).toBe('a&nbsp;b');

    const r2 = make({ remove: undefined, leave: undefined });
    expect(r2.decode('a&nbsp;b')).toBe('a&nbsp;b');
  });

  test('remove and leave arrays can contain duplicates (handled by Set)', () => {
    const r = make({ remove: ['nbsp', 'nbsp'], leave: ['copy', 'copy'] });
    expect(r.decode('a&nbsp;b&copy;c')).toBe('ab&copy;c');
  });

  test('remove and leave arrays can contain non-string values (ignored)', () => {
    const r = make({ remove: ['nbsp', 123, null, undefined], leave: ['copy', 456, false] });
    expect(r.decode('a&nbsp;b&copy;c')).toBe('ab&copy;c');
  });

  test('remove and leave arrays can contain mixed entity types', () => {
    const r = make({ remove: ['nbsp', '#160'], leave: ['copy', '&copy;'] });
    expect(r.decode('a&nbsp;b&#160;c&copy;d&amp;e')).toBe('abc&copy;d&e');
  });

  test('remove and leave arrays can contain entity names with special chars', () => {
    const r = make({ remove: ['my.entity'], leave: ['another.entity'] });
    r.setExternalEntities({ 'my.entity': 'REMOVE', 'another.entity': 'LEAVE' });
    expect(r.decode('a&my.entity;b&another.entity;c')).toBe('ab&another.entity;c');
  });

  test('remove and leave arrays can contain numeric entity strings', () => {
    const r = make({ remove: ['#160'], leave: ['#169'] });
    expect(r.decode('a&#160;b&#169;c')).toBe('ab&#169;c');
  });

  test('remove and leave arrays can contain hex numeric entity strings', () => {
    const r = make({ remove: ['#x20'], leave: ['#x26'] });
    expect(r.decode('a&#x20;b&#x26;c')).toBe('ab&#x26;c');
  });

  test('remove and leave arrays can contain mixed numeric formats', () => {
    const r = make({ remove: ['#160', '#x20'], leave: ['#169', '#x26'] });
    expect(r.decode('a&#160;b&#x20;c&#169;d&#x26;e')).toBe('abc&#169;d&#x26;e');
  });

  test('remove and leave arrays can contain mixed entity types and formats', () => {
    const r = make({
      remove: ['nbsp', '#160', '#x20', 'unknown'],
      leave: ['copy', '#169', '#x26', 'another.entity'],
      namedEntities: { copy: '©', another: 'ANOTHER' },
    });
    expect(r.decode('a&nbsp;b&#160;c&#x20;d&copy;e&#169;f&#x26;g&another.entity;&another;h&unknown;i'))
      .toBe('abcd&copy;e&#169;f&#x26;g&another.entity;ANOTHERhi');
  });
});