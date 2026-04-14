/**
 * @nodable/entities — EntitiesValueParser tests
 */

import EntitiesValueParser from '../src/EntitiesValueParser.js';
import { COMMON_HTML } from '../src/groups.js';

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------
describe('construction', () => {
  test('creates with no options', () => {
    const evp = new EntitiesValueParser();
    expect(evp.parse('&lt;')).toBe('<');
  });

  test('default XML entities active by default', () => {
    const evp = new EntitiesValueParser();
    expect(evp.parse('&lt;&gt;&quot;&apos;&amp;')).toBe('<>"\'&');
  });

  test('options.entities loads initial external entities', () => {
    const evp = new EntitiesValueParser({ entities: { brand: 'Acme', year: '2024' } });
    expect(evp.parse('&brand; &year;')).toBe('Acme 2024');
  });

  test('options.entities values with & are rejected at construction', () => {
    expect(() =>
      new EntitiesValueParser({ entities: { bad: '&something;' } })
    ).toThrow(/not contain/);
  });

  test('system group works via constructor', () => {
    const evp = new EntitiesValueParser({ system: COMMON_HTML });
    expect(evp.parse('&copy; &mdash;')).toBe('© —');
  });

  test('amp disabled via constructor', () => {
    const evp = new EntitiesValueParser({ amp: false });
    expect(evp.parse('&amp;')).toBe('&amp;');
  });
});

// ---------------------------------------------------------------------------
// addEntity()
// ---------------------------------------------------------------------------
describe('addEntity()', () => {
  test('adds a new entity', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addEntity('foo', 'FOO_VALUE');
    expect(evp.parse('&foo;')).toBe('FOO_VALUE');
  });

  test('adding multiple entities independently', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addEntity('a', 'AAA');
    evp.addEntity('b', 'BBB');
    expect(evp.parse('&a; and &b;')).toBe('AAA and BBB');
  });

  test('adding entity does not remove previously added entities', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addEntity('first', 'FIRST');
    evp.addEntity('second', 'SECOND');
    // Both should still work after adding second
    expect(evp.parse('&first; &second;')).toBe('FIRST SECOND');
  });

  test('throws when key contains &', () => {
    const evp = new EntitiesValueParser();
    expect(() => evp.addEntity('bad&key', 'val')).toThrow(/must not contain/);
  });

  test('throws when key contains ;', () => {
    const evp = new EntitiesValueParser();
    expect(() => evp.addEntity('bad;key', 'val')).toThrow(/must not contain/);
  });

  test('throws when value contains &', () => {
    const evp = new EntitiesValueParser();
    expect(() => evp.addEntity('key', '&recursive;')).toThrow(/not contain/);
  });

  test('throws when value is not a string', () => {
    const evp = new EntitiesValueParser();
    expect(() => evp.addEntity('key', 42)).toThrow(/plain string/);
  });
});

// ---------------------------------------------------------------------------
// addInputEntities() — DOCTYPE integration
// ---------------------------------------------------------------------------
describe('addInputEntities()', () => {
  test('plain string values from DOCTYPE', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addInputEntities({ company: 'Nodable', version: '1.0' });
    expect(evp.parse('&company; v&version;')).toBe('Nodable v1.0');
  });

  test('accepts { regx, val } objects from DocTypeReader', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addInputEntities({
      myent: { regx: /&myent;/g, val: 'RESOLVED' },
    });
    expect(evp.parse('&myent;')).toBe('RESOLVED');
  });

  test('accepts { regex, val } objects (normalised form)', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addInputEntities({
      myent: { regex: /&myent;/g, val: 'RESOLVED' },
    });
    expect(evp.parse('&myent;')).toBe('RESOLVED');
  });

  test('resets per-document expansion counters', () => {
    const evp = new EntitiesValueParser({
      default: false,
      amp: false,
      maxTotalExpansions: 2,
      applyLimitsTo: 'external',
    });
    evp.addInputEntities({ x: 'X' });
    evp.parse('&x;&x;'); // exhaust counter

    // Second document — addInputEntities resets counters
    evp.addInputEntities({ x: 'X' });
    expect(() => evp.parse('&x;&x;')).not.toThrow();
  });

  test('DOCTYPE entities supersede previous document entities', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addInputEntities({ brand: 'Old' });
    expect(evp.parse('&brand;')).toBe('Old');

    evp.addInputEntities({ brand: 'New' });
    expect(evp.parse('&brand;')).toBe('New');
  });
});

// ---------------------------------------------------------------------------
// parse() — ValueParser interface
// ---------------------------------------------------------------------------
describe('parse()', () => {
  test('returns non-string input unchanged', () => {
    const evp = new EntitiesValueParser();
    expect(evp.parse(null)).toBe(null);
    expect(evp.parse(42)).toBe(42);
    expect(evp.parse(undefined)).toBe(undefined);
  });

  test('context argument is ignored', () => {
    const evp = new EntitiesValueParser();
    const ctx = { elementName: 'div', isLeafNode: true };
    expect(evp.parse('&lt;', ctx)).toBe('<');
  });

  test('returns unchanged string when no & present', () => {
    const evp = new EntitiesValueParser();
    const s = 'no entities here';
    expect(evp.parse(s)).toBe(s);
  });

  test('full replacement round-trip', () => {
    const evp = new EntitiesValueParser({ system: COMMON_HTML });
    expect(evp.parse('5 &lt; 10 &amp; &copy; 2024 &mdash; done'))
      .toBe('5 < 10 & © 2024 — done');
  });
});

// ---------------------------------------------------------------------------
// Security limits propagate from constructor
// ---------------------------------------------------------------------------
describe('security limits', () => {
  test('maxTotalExpansions enforced via addInputEntities', () => {
    const evp = new EntitiesValueParser({
      default: false,
      amp: false,
      maxTotalExpansions: 3,
      applyLimitsTo: 'external',
    });
    evp.addInputEntities({ x: 'X' });
    expect(() => evp.parse('&x;&x;&x;&x;')).toThrow(/expansion count limit/);
  });

  test('postCheck propagated from constructor', () => {
    const evp = new EntitiesValueParser({
      default: true,
      postCheck: (resolved, original) =>
        /</.test(resolved) ? original : resolved,
    });
    // &lt; would resolve to < — postCheck rejects it
    expect(evp.parse('&lt;')).toBe('&lt;');
    // &amp; resolves to & — postCheck allows it
    expect(evp.parse('&amp;')).toBe('&');
  });
});
// ---------------------------------------------------------------------------
// setExternalEntities() — persistent entity registration
// ---------------------------------------------------------------------------
describe('setExternalEntities()', () => {
  test('sets persistent entities that survive getInstance()', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.setExternalEntities({ brand: 'Acme', year: '2025' });
    evp.getInstance(); // simulate new document with no DOCTYPE
    expect(evp.parse('&brand; &year;')).toBe('Acme 2025');
  });

  test('throws when value contains &', () => {
    const evp = new EntitiesValueParser();
    expect(() => evp.setExternalEntities({ bad: '&recursive;' })).toThrow(/not contain/);
  });

  test('replaces full persistent entity map on second call', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.setExternalEntities({ a: 'AAA' });
    evp.setExternalEntities({ b: 'BBB' });
    // 'a' is gone — second call replaced the map
    expect(evp.parse('&a;')).toBe('&a;');
    expect(evp.parse('&b;')).toBe('BBB');
  });
});

// ---------------------------------------------------------------------------
// getInstance() — builder factory integration
// ---------------------------------------------------------------------------
describe('getInstance()', () => {
  test('returns same instance', () => {
    const evp = new EntitiesValueParser();
    expect(evp.getInstance()).toBe(evp);
  });

  test('clears input entities from previous document', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addInputEntities({ tmp: 'DOC1_VALUE' });
    evp.getInstance(); // next document — no DOCTYPE
    expect(evp.parse('&tmp;')).toBe('&tmp;');
  });

  test('does NOT clear persistent (external) entities', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    evp.addEntity('brand', 'Acme');
    evp.getInstance();
    expect(evp.parse('&brand;')).toBe('Acme');
  });

  test('resets expansion counters for next document', () => {
    const evp = new EntitiesValueParser({
      default: false,
      amp: false,
      maxTotalExpansions: 2,
      applyLimitsTo: 'external',
    });
    evp.addInputEntities({ x: 'X' });
    evp.parse('&x;&x;'); // exhaust counter
    evp.getInstance();   // reset — even with no DOCTYPE on next doc
    evp.addInputEntities({ x: 'X' });
    expect(() => evp.parse('&x;&x;')).not.toThrow();
  });

  test('document without DOCTYPE after one with DOCTYPE does not bleed entities', () => {
    const evp = new EntitiesValueParser({ default: false, amp: false });
    // Document 1: has DOCTYPE with &company;
    evp.addInputEntities({ company: 'Nodable' });
    expect(evp.parse('&company;')).toBe('Nodable');
    // Document 2: no DOCTYPE — getInstance() called, no addInputEntities
    evp.getInstance();
    expect(evp.parse('&company;')).toBe('&company;');
  });
});
