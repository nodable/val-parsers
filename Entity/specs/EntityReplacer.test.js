/**
 * @nodable/entities — test suite
 * Run with: node --experimental-vm-modules node_modules/.bin/jest
 */

import EntityReplacer, {
  DEFAULT_XML_ENTITIES,
  AMP_ENTITY,
} from '../src/EntityReplacer.js';

import {
  COMMON_HTML,
  CURRENCY_ENTITIES,
  MATH_ENTITIES,
  ARROW_ENTITIES,
  NUMERIC_ENTITIES,
} from '../src/groups.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function make(opts) {
  return new EntityReplacer(opts);
}

// ---------------------------------------------------------------------------
// 1. Fast path
// ---------------------------------------------------------------------------
describe('fast path — no & in string', () => {
  const r = make({ default: true });

  test('returns same reference when no & present', () => {
    const s = 'hello world';
    expect(r.replace(s)).toBe(s);
  });

  test('returns empty string unchanged', () => {
    expect(r.replace('')).toBe('');
  });

  test('handles non-string input gracefully', () => {
    expect(r.replace(null)).toBe(null);
    expect(r.replace(undefined)).toBe(undefined);
    expect(r.replace(42)).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// 2. Default XML entities
// ---------------------------------------------------------------------------
describe('default XML entities', () => {
  const r = make({ default: true, amp: true });

  test('replaces &lt;', () => expect(r.replace('&lt;')).toBe('<'));
  test('replaces &gt;', () => expect(r.replace('&gt;')).toBe('>'));
  test('replaces &quot;', () => expect(r.replace('&quot;')).toBe('"'));
  test('replaces &apos;', () => expect(r.replace('&apos;')).toBe("'"));
  test('replaces &amp; (last)', () => expect(r.replace('&amp;')).toBe('&'));

  test('replaces multiple in one string', () => {
    expect(r.replace('a &lt; b &gt; c')).toBe('a < b > c');
  });

  test('numeric decimal ref for lt', () => {
    const rn = make({ default: true, system: NUMERIC_ENTITIES, amp: true });
    expect(rn.replace('&#60;')).toBe('<');
  });

  test('numeric hex ref for gt', () => {
    const rn = make({ default: true, system: NUMERIC_ENTITIES, amp: true });
    expect(rn.replace('&#x3E;')).toBe('>');
  });

  test('&amp; does not double-expand &amp;lt;', () => {
    // &amp;lt; should become &lt; not <
    expect(r.replace('&amp;lt;')).toBe('&lt;');
  });

  test('disabled when default: false', () => {
    const r2 = make({ default: false, amp: false });
    expect(r2.replace('&lt;')).toBe('&lt;');
  });

  test('custom default table used when passed object', () => {
    const custom = { foo: { regex: /&foo;/g, val: 'BAR' } };
    const r2 = make({ default: custom, amp: false });
    expect(r2.replace('&foo;')).toBe('BAR');
    expect(r2.replace('&lt;')).toBe('&lt;'); // built-in not active
  });
});

// ---------------------------------------------------------------------------
// 3. amp option
// ---------------------------------------------------------------------------
describe('amp option', () => {
  test('amp: true replaces &amp;', () => {
    expect(make({ amp: true }).replace('&amp;')).toBe('&');
  });

  test('amp: false leaves &amp; alone', () => {
    expect(make({ amp: false }).replace('&amp;')).toBe('&amp;');
  });

  test('amp: null leaves &amp; alone', () => {
    expect(make({ amp: null }).replace('&amp;')).toBe('&amp;');
  });
});

// ---------------------------------------------------------------------------
// 4. System entity groups
// ---------------------------------------------------------------------------
describe('COMMON_HTML system group', () => {
  const r = make({ default: true, system: COMMON_HTML, amp: true });

  test('&nbsp;', () => expect(r.replace('&nbsp;')).toBe('\u00a0'));
  test('&copy;', () => expect(r.replace('&copy;')).toBe('\u00a9'));
  test('&reg;', () => expect(r.replace('&reg;')).toBe('\u00ae'));
  test('&trade;', () => expect(r.replace('&trade;')).toBe('\u2122'));
  test('&mdash;', () => expect(r.replace('&mdash;')).toBe('\u2014'));
  test('&ndash;', () => expect(r.replace('&ndash;')).toBe('\u2013'));
  test('&hellip;', () => expect(r.replace('&hellip;')).toBe('\u2026'));
});

describe('CURRENCY_ENTITIES', () => {
  const r = make({ system: CURRENCY_ENTITIES, amp: false });

  test('&cent;', () => expect(r.replace('&cent;')).toBe('\u00a2'));
  test('&pound;', () => expect(r.replace('&pound;')).toBe('\u00a3'));
  test('&yen;', () => expect(r.replace('&yen;')).toBe('\u00a5'));
  test('&euro;', () => expect(r.replace('&euro;')).toBe('\u20ac'));
  test('&inr;', () => expect(r.replace('&inr;')).toBe('\u20b9'));
});

describe('MATH_ENTITIES', () => {
  const r = make({ system: MATH_ENTITIES, amp: false });

  test('&times;', () => expect(r.replace('&times;')).toBe('\u00d7'));
  test('&divide;', () => expect(r.replace('&divide;')).toBe('\u00f7'));
  test('&plusmn;', () => expect(r.replace('&plusmn;')).toBe('\u00b1'));
  test('&minus;', () => expect(r.replace('&minus;')).toBe('\u2212'));
  test('&ne;', () => expect(r.replace('&ne;')).toBe('\u2260'));
  test('&le;', () => expect(r.replace('&le;')).toBe('\u2264'));
  test('&ge;', () => expect(r.replace('&ge;')).toBe('\u2265'));
});

describe('ARROW_ENTITIES', () => {
  const r = make({ system: ARROW_ENTITIES, amp: false });

  test('&rarr;', () => expect(r.replace('&rarr;')).toBe('\u2192'));
  test('&larr;', () => expect(r.replace('&larr;')).toBe('\u2190'));
  test('&harr;', () => expect(r.replace('&harr;')).toBe('\u2194'));
  test('&uarr;', () => expect(r.replace('&uarr;')).toBe('\u2191'));
  test('&darr;', () => expect(r.replace('&darr;')).toBe('\u2193'));
  test('&rArr;', () => expect(r.replace('&rArr;')).toBe('\u21d2'));
});

describe('NUMERIC_ENTITIES', () => {
  const r = make({ system: NUMERIC_ENTITIES, amp: false });

  test('decimal &#65; → A', () => expect(r.replace('&#65;')).toBe('A'));
  test('decimal with leading zeros &#0065; → A', () => expect(r.replace('&#0065;')).toBe('A'));
  test('hex &#x41; → A', () => expect(r.replace('&#x41;')).toBe('A'));
  test('hex uppercase &#X41; is NOT matched (spec: only lowercase x)', () => {
    // The spec only handles &#x...; (lowercase x)
    expect(r.replace('&#X41;')).toBe('&#X41;');
  });
  test('emoji via decimal &#128512;', () => expect(r.replace('&#128512;')).toBe('😀'));
  test('emoji via hex &#x1F600;', () => expect(r.replace('&#x1F600;')).toBe('😀'));
});

describe('composed system groups', () => {
  const r = make({ system: { ...COMMON_HTML, ...CURRENCY_ENTITIES }, amp: false });

  test('both groups active', () => {
    expect(r.replace('&copy; &euro;')).toBe('\u00a9 \u20ac');
  });
});

// ---------------------------------------------------------------------------
// 5. External entities — persistent (setExternalEntities / addExternalEntity)
//    and input/runtime (addInputEntities / getInstance)
// ---------------------------------------------------------------------------
describe('persistent external entities (setExternalEntities)', () => {
  test('basic persistent entity', () => {
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ foo: 'bar' });
    expect(r.replace('&foo;')).toBe('bar');
  });

  test('multiple persistent entities', () => {
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ foo: 'FOO', baz: 'BAZ' });
    expect(r.replace('&foo; and &baz;')).toBe('FOO and BAZ');
  });

  test('entity name with regex special chars is escaped', () => {
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ 'my.entity': 'VALUE' });
    expect(r.replace('&my.entity;')).toBe('VALUE');
  });

  test('values containing & are silently skipped', () => {
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ bad: '&something;' });
    expect(r.replace('&bad;')).toBe('&bad;');
  });

  test('accepts pre-built { regex, val } objects', () => {
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ custom: { regex: /&custom;/g, val: 'CUSTOM_VALUE' } });
    expect(r.replace('&custom;')).toBe('CUSTOM_VALUE');
  });

  test('throws on invalid entity name character', () => {
    const r = make({});
    expect(() => r.setExternalEntities({ 'bad&name': 'x' })).toThrow();
  });

  test('addExternalEntity appends without wiping existing entries', () => {
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ a: 'AAA' });
    r.addExternalEntity('b', 'BBB');
    expect(r.replace('&a; &b;')).toBe('AAA BBB');
  });

  test('persistent entities survive getInstance()', () => {
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ brand: 'Acme' });
    r.getInstance(); // simulates new document
    expect(r.replace('&brand;')).toBe('Acme');
  });
});

describe('input / runtime entities (addInputEntities)', () => {
  test('basic input entity', () => {
    const r = make({ default: false, amp: false });
    r.addInputEntities({ foo: 'bar' });
    expect(r.replace('&foo;')).toBe('bar');
  });

  test('accepts DocTypeReader { regx, val } objects', () => {
    const r = make({ default: false, amp: false });
    r.addInputEntities({ ent: { regx: /&ent;/g, val: 'RESOLVED' } });
    expect(r.replace('&ent;')).toBe('RESOLVED');
  });

  test('addInputEntities resets counters', () => {
    const r = make({ maxTotalExpansions: 5, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    r.replace('&x;&x;&x;'); // 3 expansions
    r.addInputEntities({ x: 'X' }); // resets counter
    expect(() => r.replace('&x;&x;&x;&x;&x;')).not.toThrow(); // exactly 5 — ok
  });

  test('getInstance() wipes input entities', () => {
    const r = make({ default: false, amp: false });
    r.addInputEntities({ docEnt: 'VALUE' });
    expect(r.replace('&docEnt;')).toBe('VALUE');
    r.getInstance(); // simulate next document — no DOCTYPE
    expect(r.replace('&docEnt;')).toBe('&docEnt;'); // wiped
  });

  test('getInstance() resets counters', () => {
    const r = make({ maxTotalExpansions: 2, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    r.replace('&x;&x;'); // exhaust counter
    r.getInstance(); // reset
    r.addInputEntities({ x: 'X' });
    expect(() => r.replace('&x;&x;')).not.toThrow();
  });

  test('input entities do not bleed across documents without addInputEntities', () => {
    const r = make({ default: false, amp: false });
    r.addInputEntities({ tmp: 'DOC1' });
    r.getInstance(); // second document has no DOCTYPE
    // tmp must be gone — getInstance() wipes input entries
    expect(r.replace('&tmp;')).toBe('&tmp;');
  });
});

describe('persistent vs input priority', () => {
  test('persistent entity wins when input has same name', () => {
    // Persistent is applied first in the replacement pipeline
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ ent: 'PERSISTENT' });
    r.addInputEntities({ ent: 'INPUT' });
    // persistent replaces &ent; first → INPUT never sees it
    expect(r.replace('&ent;')).toBe('PERSISTENT');
  });
});

// ---------------------------------------------------------------------------
// 6. Processing order
// ---------------------------------------------------------------------------
describe('processing order', () => {
  test('external processed before default', () => {
    // External entity &lt; should win over built-in lt
    const r = make({ default: true, amp: false });
    r.setExternalEntities({ lt: 'LESSTHAN' });

    expect(r.replace('&lt;')).toBe('LESSTHAN');
  });

  test('amp is always last — &amp;lt; → &lt;, not <', () => {
    const r = make({ default: true, amp: true });
    expect(r.replace('&amp;lt;')).toBe('&lt;');
  });

  test('&amp; after system expansion', () => {
    const r = make({ system: COMMON_HTML, amp: true });
    // If system expansion produced &amp; it should then expand
    // Here we just verify amp runs after system
    expect(r.replace('&amp;')).toBe('&');
  });
});

// ---------------------------------------------------------------------------
// 7. Security limits
// ---------------------------------------------------------------------------
describe('maxTotalExpansions', () => {
  test('throws when limit exceeded (external)', () => {
    const r = make({ maxTotalExpansions: 3, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    expect(() => r.replace('&x;&x;&x;&x;')).toThrow(/expansion count limit/);
  });

  test('does not throw when exactly at limit', () => {
    const r = make({ maxTotalExpansions: 3, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    expect(() => r.replace('&x;&x;&x;')).not.toThrow();
  });

  test('0 = unlimited', () => {
    const r = make({ maxTotalExpansions: 0, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    const big = '&x;'.repeat(10_000);
    expect(() => r.replace(big)).not.toThrow();
  });

  test('default entities not tracked when applyLimitsTo: external', () => {
    const r = make({ default: true, maxTotalExpansions: 1, applyLimitsTo: 'external' });
    // Many default XML entity expansions — should NOT throw
    expect(() => r.replace('&lt;&gt;&lt;&gt;&lt;&gt;')).not.toThrow();
  });

  test('default entities tracked when applyLimitsTo: all', () => {
    const r = make({ default: true, maxTotalExpansions: 2, applyLimitsTo: 'all', amp: false });
    expect(() => r.replace('&lt;&gt;&lt;')).toThrow(/expansion count limit/);
  });

  test('system entities tracked when specified', () => {
    const r = make({
      system: COMMON_HTML,
      maxTotalExpansions: 2,
      applyLimitsTo: ['system'],
      amp: false,
    });
    expect(() => r.replace('&copy;&copy;&copy;')).toThrow(/expansion count limit/);
  });
});

describe('maxExpandedLength', () => {
  test('throws when expanded length exceeded', () => {
    // &x; (3 chars) → 'XXXXXXXXXX' (10 chars) = net +7; limit is 5
    const r = make({ maxExpandedLength: 5, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'XXXXXXXXXX' });
    expect(() => r.replace('&x;')).toThrow(/length limit/);
  });

  test('does not throw when exactly at limit', () => {
    // &x; (3 chars) → 'XXXXXXXX' (8 chars) = net +5; limit is 5
    const r = make({ maxExpandedLength: 5, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'XXXXXXXX' });
    expect(() => r.replace('&x;')).not.toThrow();
  });

  test('cumulative across multiple replacements', () => {
    // &x; (3 chars) → 'XXXXX' (5 chars) = net +2 per expansion
    // Two expansions = +4 total; limit is 10 — should be fine
    const r = make({ maxExpandedLength: 10, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'XXXXX' });
    expect(() => r.replace('&x;&x;')).not.toThrow();
  });
});

describe('applyLimitsTo: array', () => {
  test('limits both external and system when both specified', () => {
    const r = make({
      system: COMMON_HTML,
      maxTotalExpansions: 1,
      applyLimitsTo: ['external', 'system'],
      amp: false,
    });
    r.addInputEntities({ x: 'X' });
    // 1 external + 1 system = 2 > limit of 1
    expect(() => r.replace('&x;&copy;')).toThrow(/expansion count limit/);
  });
});

// ---------------------------------------------------------------------------
// 8. postCheck hook
// ---------------------------------------------------------------------------
describe('postCheck', () => {
  test('called with resolved and original', () => {
    let args;
    const r = make({
      default: true,
      postCheck: (resolved, original) => {
        args = { resolved, original };
        return resolved;
      },
    });
    r.replace('&lt;');
    expect(args.original).toBe('&lt;');
    expect(args.resolved).toBe('<');
  });

  test('returning original rejects expansion', () => {
    const r = make({
      default: true,
      postCheck: (resolved, original) =>
        /</.test(resolved) ? original : resolved,
    });
    expect(r.replace('&lt;')).toBe('&lt;'); // rejected
    expect(r.replace('&amp;')).toBe('&'); // allowed
  });

  test('can sanitize resolved string', () => {
    const r = make({
      default: true,
      postCheck: (resolved) => resolved.replace(/<[^>]*>/g, ''),
    });
    expect(r.replace('hello &lt;script&gt;')).toBe('hello ');
  });

  test('not called when string has no & (fast path)', () => {
    let called = false;
    const r = make({
      postCheck: () => { called = true; return ''; },
    });
    r.replace('no entities here');
    expect(called).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// 9. getInstance() — builder factory integration
// ---------------------------------------------------------------------------
describe('getInstance()', () => {
  test('returns same instance (this)', () => {
    const r = make({ default: true });
    expect(r.getInstance()).toBe(r);
  });

  test('clears input entities', () => {
    const r = make({ default: false, amp: false });
    r.addInputEntities({ tmp: 'DOC1' });
    r.getInstance();
    expect(r.replace('&tmp;')).toBe('&tmp;');
  });

  test('resets totalExpansions counter', () => {
    const r = make({ maxTotalExpansions: 2, applyLimitsTo: 'external' });
    r.addInputEntities({ x: 'X' });
    r.replace('&x;&x;'); // exhaust counter
    r.getInstance();
    r.addInputEntities({ x: 'X' });
    expect(() => r.replace('&x;&x;')).not.toThrow();
  });

  test('does NOT clear persistent entities', () => {
    const r = make({ default: false, amp: false });
    r.setExternalEntities({ brand: 'Acme' });
    r.getInstance();
    expect(r.replace('&brand;')).toBe('Acme');
  });
});

// ---------------------------------------------------------------------------
// 10. Edge cases
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  test('unknown entity is left unchanged', () => {
    const r = make({ default: true });
    expect(r.replace('&unknown;')).toBe('&unknown;');
  });

  test('partial entity ref is left unchanged', () => {
    const r = make({ default: true });
    expect(r.replace('&lt')).toBe('&lt'); // no closing ;
  });

  test('entity at start of string', () => {
    const r = make({ default: true });
    expect(r.replace('&lt;hello')).toBe('<hello');
  });

  test('entity at end of string', () => {
    const r = make({ default: true });
    expect(r.replace('hello&gt;')).toBe('hello>');
  });

  test('consecutive entities with no whitespace', () => {
    const r = make({ default: true });
    expect(r.replace('&lt;&gt;')).toBe('<>');
  });

  test('very long string with no entities', () => {
    const r = make({ default: true });
    const s = 'a'.repeat(100_000);
    expect(r.replace(s)).toBe(s);
  });

  test('string with only & (no valid entity)', () => {
    const r = make({ default: true });
    expect(r.replace('& ')).toBe('& ');
  });

  test('numeric refs with leading zeros', () => {
    const r = make({ system: NUMERIC_ENTITIES });
    expect(r.replace('&#00065;')).toBe('A'); // decimal with zeros
    expect(r.replace('&#x00041;')).toBe('A'); // hex with zeros
  });
});

// ---------------------------------------------------------------------------
// 11. Exports
// ---------------------------------------------------------------------------
describe('exports', () => {
  test('DEFAULT_XML_ENTITIES is a plain object with expected keys', () => {
    expect(typeof DEFAULT_XML_ENTITIES).toBe('object');
    expect(DEFAULT_XML_ENTITIES).toHaveProperty('lt');
    expect(DEFAULT_XML_ENTITIES).toHaveProperty('gt');
    expect(DEFAULT_XML_ENTITIES).toHaveProperty('quot');
    expect(DEFAULT_XML_ENTITIES).toHaveProperty('apos');
  });

  test('AMP_ENTITY has regex and val', () => {
    expect(AMP_ENTITY).toHaveProperty('regex');
    expect(AMP_ENTITY).toHaveProperty('val');
  });

  test('all groups are plain objects', () => {
    for (const g of [COMMON_HTML, CURRENCY_ENTITIES, MATH_ENTITIES, ARROW_ENTITIES, NUMERIC_ENTITIES]) {
      expect(typeof g).toBe('object');
      expect(g).not.toBeNull();
    }
  });
});