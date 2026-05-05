// EntityDecoder.ncr.test.js
// Tests for Numeric Character Reference (NCR) handling in EntityDecoder

import assert from 'node:assert/strict';
import EntityDecoder from '../src/EntityDecoder.js';

describe('EntityDecoder NCR Support', () => {
  describe('Basic numeric decoding', () => {
    it('should decode decimal NCRs', () => {
      const dec = new EntityDecoder();
      assert.equal(dec.decode('&#60;'), '<');
      assert.equal(dec.decode('&#38;'), '&');
      assert.equal(dec.decode('&#65;'), 'A');
    });

    it('should decode hexadecimal NCRs (lowercase x)', () => {
      const dec = new EntityDecoder();
      assert.equal(dec.decode('&#x3C;'), '<');
      assert.equal(dec.decode('&#x26;'), '&');
      assert.equal(dec.decode('&#x41;'), 'A');
    });

    it('should decode hexadecimal NCRs (uppercase X)', () => {
      const dec = new EntityDecoder();
      assert.equal(dec.decode('&#X3C;'), '<');
      assert.equal(dec.decode('&#X26;'), '&');
      assert.equal(dec.decode('&#X41;'), 'A');
    });

    it('should handle mixed content with NCRs', () => {
      const dec = new EntityDecoder();
      const result = dec.decode('foo &#60; bar &#x3E; baz');
      assert.equal(result, 'foo < bar > baz');
    });
  });

  describe('numericAllowed flag', () => {
    it('should decode NCRs when numericAllowed = true (default)', () => {
      const dec = new EntityDecoder({ numericAllowed: true });
      assert.equal(dec.decode('&#60;'), '<');
    });

    it('should leave NCRs as literal when numericAllowed = false (safe NCRs)', () => {
      const dec = new EntityDecoder({ numericAllowed: false });
      assert.equal(dec.decode('&#60;'), '&#60;');
      assert.equal(dec.decode('&#x3C;'), '&#x3C;');
    });

    it('should still enforce prohibited codepoints even when numericAllowed = false', () => {
      // Surrogate range must be removed/throw regardless of numericAllowed
      const decRemove = new EntityDecoder({ numericAllowed: false, ncr: { onNCR: 'allow' } });
      assert.equal(decRemove.decode('&#xD800;'), ''); // removed because min action = remove

      const decThrow = new EntityDecoder({ numericAllowed: false, ncr: { onNCR: 'throw' } });
      assert.throws(() => decThrow.decode('&#xD800;'), /Prohibited numeric character reference/);
    });
  });

  describe('NCR policy: onNCR action', () => {
    it('should allow decoding when onNCR = "allow" (default)', () => {
      const dec = new EntityDecoder({ ncr: { onNCR: 'allow' } });
      assert.equal(dec.decode('&#60;'), '<');
      assert.equal(dec.decode('&#x263A;'), '☺');
    });

    it('should leave NCRs as literal when onNCR = "leave"', () => {
      const dec = new EntityDecoder({ ncr: { onNCR: 'leave' } });
      assert.equal(dec.decode('&#60;'), '&#60;');
      assert.equal(dec.decode('&#x263A;'), '&#x263A;');
    });

    it('should remove NCRs (replace with empty string) when onNCR = "remove"', () => {
      const dec = new EntityDecoder({ ncr: { onNCR: 'remove' } });
      assert.equal(dec.decode('Hello &#60; world'), 'Hello  world');
      assert.equal(dec.decode('&#x263A;'), '');
    });

    it('should throw on any NCR when onNCR = "throw"', () => {
      const dec = new EntityDecoder({ ncr: { onNCR: 'throw' } });
      assert.throws(() => dec.decode('&#60;'), /Prohibited numeric character reference/);
      assert.throws(() => dec.decode('&#x263A;'), /Prohibited numeric character reference/);
    });
  });

  describe('Null character (U+0000) handling', () => {
    it('should remove null by default (nullNCR = "remove")', () => {
      const dec = new EntityDecoder(); // default nullNCR = 'remove'
      assert.equal(dec.decode('&#0;'), '');
      assert.equal(dec.decode('&#x0;'), '');
    });

    it('should throw on null when nullNCR = "throw"', () => {
      const dec = new EntityDecoder({ ncr: { nullNCR: 'throw' } });
      assert.throws(() => dec.decode('&#0;'), /Prohibited numeric character reference.*U\+0000/);
      assert.throws(() => dec.decode('&#x0;'), /Prohibited numeric character reference.*U\+0000/);
    });

    it('should clamp "allow" and "leave" to "remove" for null', () => {
      const decAllow = new EntityDecoder({ ncr: { onNCR: 'allow', nullNCR: 'allow' } });
      assert.equal(decAllow.decode('&#0;'), ''); // still removed

      const decLeave = new EntityDecoder({ ncr: { onNCR: 'leave', nullNCR: 'leave' } });
      assert.equal(decLeave.decode('&#0;'), ''); // removed, not left as literal
    });
  });

  describe('Surrogate range (U+D800–U+DFFF) handling', () => {
    it('should remove surrogates by default (minimum action = remove)', () => {
      const dec = new EntityDecoder(); // onNCR='allow', but surrogates min=remove
      assert.equal(dec.decode('&#xD800;'), '');
      assert.equal(dec.decode('&#xDFFF;'), '');
    });

    it('should throw surrogates if onNCR = "throw" (max of allow and remove = throw)', () => {
      const dec = new EntityDecoder({ ncr: { onNCR: 'throw' } });
      assert.throws(() => dec.decode('&#xD800;'), /Prohibited numeric character reference.*U\+D800/);
    });

    it('should remove surrogates even when onNCR = "leave" (min > leave)', () => {
      const dec = new EntityDecoder({ ncr: { onNCR: 'leave' } });
      assert.equal(dec.decode('&#xD800;'), ''); // removed because min=remove > leave
    });
  });

  describe('XML version differences (C0 controls U+0001–U+001F)', () => {
    // C0 controls except U+0009 (tab), U+000A (LF), U+000D (CR)
    const restrictedCodepoints = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x0B, 0x0C, 0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
      0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D, 0x1E, 0x1F];

    const allowedC0 = [0x09, 0x0A, 0x0D];

    it('XML 1.0: should remove restricted C0 controls by default (min=remove)', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.0, onNCR: 'allow' } });
      for (const cp of restrictedCodepoints) {
        const ncr = `&#${cp};`;
        assert.equal(dec.decode(ncr), '', `U+${cp.toString(16)} should be removed in XML 1.0`);
      }
    });

    it('XML 1.0: should allow tab, LF, CR', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.0, onNCR: 'allow' } });
      for (const cp of allowedC0) {
        const ncr = `&#${cp};`;
        const expected = String.fromCodePoint(cp);
        assert.equal(dec.decode(ncr), expected, `U+${cp.toString(16)} should be allowed in XML 1.0`);
      }
    });

    it('XML 1.0: onNCR="leave" still removes restricted C0 (min > leave)', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.0, onNCR: 'leave' } });
      assert.equal(dec.decode('&#x01;'), ''); // removed
    });

    it('XML 1.0: onNCR="throw" throws on restricted C0', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.0, onNCR: 'throw' } });
      assert.throws(() => dec.decode('&#x01;'), /Prohibited numeric character reference.*U\+0001/);
    });

    it('XML 1.1: should allow C0 controls (no minimum restriction)', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.1, onNCR: 'allow' } });
      for (const cp of restrictedCodepoints) {
        const ncr = `&#${cp};`;
        const expected = String.fromCodePoint(cp);
        assert.equal(dec.decode(ncr), expected, `U+${cp.toString(16)} should be allowed in XML 1.1 as NCR`);
      }
    });

    it('XML 1.1: onNCR="leave" leaves C0 controls as literal', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.1, onNCR: 'leave' } });
      assert.equal(dec.decode('&#x01;'), '&#x01;'); // left literal because no minimum restriction
    });

    it('XML 1.1: onNCR="remove" removes C0 controls', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.1, onNCR: 'remove' } });
      assert.equal(dec.decode('&#x01;'), '');
    });
  });

  describe('setXmlVersion runtime update', () => {
    it('should allow switching from XML 1.0 to 1.1 after construction', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.0, onNCR: 'allow' } });
      // Initially XML 1.0: restricted C0 removed
      assert.equal(dec.decode('&#x01;'), '');

      dec.setXmlVersion(1.1);
      // Now XML 1.1: C0 allowed
      assert.equal(dec.decode('&#x01;'), String.fromCodePoint(0x01));
    });

    it('should allow switching from XML 1.1 to 1.0', () => {
      const dec = new EntityDecoder({ ncr: { xmlVersion: 1.1, onNCR: 'allow' } });
      assert.equal(dec.decode('&#x01;'), String.fromCodePoint(0x01));

      dec.setXmlVersion(1.0);
      assert.equal(dec.decode('&#x01;'), '');
    });

    it('should treat any version not 1.1 as 1.0', () => {
      const dec = new EntityDecoder({ ncr: { onNCR: 'allow' } });
      dec.setXmlVersion(2.0);
      // Should behave as XML 1.0 (restricted C0 removed)
      assert.equal(dec.decode('&#x01;'), '');
    });
  });

  describe('Invalid NCRs (out of range, malformed)', () => {
    it('should leave out-of-range codepoints as literal', () => {
      const dec = new EntityDecoder();
      assert.equal(dec.decode('&#x110000;'), '&#x110000;'); // > 0x10FFFF
      assert.equal(dec.decode('&#-1;'), '&#-1;');
      assert.equal(dec.decode('&#NaN;'), '&#NaN;');
    });

    it('should leave malformed hex NCRs as literal', () => {
      const dec = new EntityDecoder();
      assert.equal(dec.decode('&#xZZZ;'), '&#xZZZ;');
      assert.equal(dec.decode('&#x;'), '&#x;');
    });

    it('should leave malformed decimal NCRs as literal', () => {
      const dec = new EntityDecoder();
      assert.equal(dec.decode('&#;'), '&#;');
    });
  });

  describe('Interaction with security limits', () => {
    it('should count numeric entities toward base tier limits', () => {
      const dec = new EntityDecoder({
        limit: {
          maxTotalExpansions: 2,
          applyLimitsTo: 'base'
        }
      });

      dec.decode('&#60;'); // expansion 1
      dec.decode('&#62;'); // expansion 2
      // Third expansion should exceed limit
      assert.throws(() => dec.decode('&#38;'), /Entity expansion count limit exceeded/);
    });

    it('should not count numeric entities when limits apply only to external tier', () => {
      const dec = new EntityDecoder({
        limit: {
          maxTotalExpansions: 1,
          applyLimitsTo: 'external'
        }
      });
      // Numeric entities are base tier, so they should not be counted
      dec.decode('&#60;');
      dec.decode('&#62;');
      dec.decode('&#38;');
      // No error
    });
  });

  describe('addExternalEntity with #-prefixed names (numeric character references)', () => {
    it('should allow registering #xD as an external entity without throwing', () => {
      const dec = new EntityDecoder();
      // AWS SDK registers &#xD; (carriage return) via addExternalEntity
      dec.addExternalEntity('#xD', '\r');
      // The entity should be registered and decodable
      assert.equal(dec.decode('&#xD;'), '\r');
    });

    it('should allow registering decimal numeric references like #13', () => {
      const dec = new EntityDecoder();
      dec.addExternalEntity('#13', '\r');
      assert.equal(dec.decode('&#13;'), '\r');
    });

    it('should still reject truly invalid entity names with special chars', () => {
      const dec = new EntityDecoder();
      assert.throws(() => dec.addExternalEntity('bad!name', 'x'), /Invalid character/);
      assert.throws(() => dec.addExternalEntity('bad*name', 'x'), /Invalid character/);
    });
  });

  describe('Edge cases and combinations', () => {
    it('should handle NCRs adjacent to text without delimiters', () => {
      const dec = new EntityDecoder();
      assert.equal(dec.decode('foo&#60;bar'), 'foo<bar');
      assert.equal(dec.decode('&#60;bar'), '<bar');
      assert.equal(dec.decode('foo&#60;'), 'foo<');
    });

    it('should handle multiple NCRs in one string', () => {
      const dec = new EntityDecoder();
      const input = '&#60;&#x3E;&#38;&#x26;&#65;&#x41;';
      assert.equal(dec.decode(input), '<>&&AA');
    });

    it('should respect removeSet for numeric tokens (if token exact match)', () => {
      // removeSet works on the token string, e.g., '#60'
      const dec = new EntityDecoder({ remove: ['#60'] });
      assert.equal(dec.decode('&#60;'), ''); // removed
      assert.equal(dec.decode('&#x3C;'), '<'); // hex form not removed
    });

    it('should respect leaveSet for numeric tokens', () => {
      const dec = new EntityDecoder({ leave: ['#60'] });
      assert.equal(dec.decode('&#60;'), '&#60;'); // left as literal
      assert.equal(dec.decode('&#x3C;'), '<'); // hex form decoded normally
    });

    it('should apply postCheck hook to final decoded string', () => {
      let called = false;
      const dec = new EntityDecoder({
        postCheck: (resolved, original) => {
          called = true;
          return resolved + '!';
        }
      });
      const result = dec.decode('&#60;');
      assert.ok(called);
      assert.equal(result, '<!');
    });
  });
});