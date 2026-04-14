// ---------------------------------------------------------------------------
// Named entity groups — importable separately and freely composable.
// All groups are plain objects; no magic, no classes.
// ---------------------------------------------------------------------------

/**
 * ~20 most commonly needed HTML named entities.
 * @type {Record<string, { regex: RegExp, val: string | ((m: string, s: string) => string) }>}
 */
export const COMMON_HTML = {
  nbsp: { regex: /&(nbsp|#0*160|#x0*[Aa]0);/g, val: '\u00a0' },
  copy: { regex: /&(copy|#0*169|#x0*[Aa]9);/g, val: '\u00a9' },
  reg: { regex: /&(reg|#0*174|#x0*[Aa][Ee]);/g, val: '\u00ae' },
  trade: { regex: /&(trade|#0*8482|#x0*2122);/g, val: '\u2122' },
  mdash: { regex: /&(mdash|#0*8212|#x0*2014);/g, val: '\u2014' },
  ndash: { regex: /&(ndash|#0*8211|#x0*2013);/g, val: '\u2013' },
  hellip: { regex: /&(hellip|#0*8230|#x0*2026);/g, val: '\u2026' },
  laquo: { regex: /&(laquo|#0*171|#x0*[Aa][Bb]);/g, val: '\u00ab' },
  raquo: { regex: /&(raquo|#0*187|#x0*[Bb][Bb]);/g, val: '\u00bb' },
  lsquo: { regex: /&(lsquo|#0*8216|#x0*2018);/g, val: '\u2018' },
  rsquo: { regex: /&(rsquo|#0*8217|#x0*2019);/g, val: '\u2019' },
  ldquo: { regex: /&(ldquo|#0*8220|#x0*201[Cc]);/g, val: '\u201c' },
  rdquo: { regex: /&(rdquo|#0*8221|#x0*201[Dd]);/g, val: '\u201d' },
  bull: { regex: /&(bull|#0*8226|#x0*2022);/g, val: '\u2022' },
  para: { regex: /&(para|#0*182|#x0*[Bb]6);/g, val: '\u00b6' },
  sect: { regex: /&(sect|#0*167|#x0*[Aa]7);/g, val: '\u00a7' },
  deg: { regex: /&(deg|#0*176|#x0*[Bb]0);/g, val: '\u00b0' },
  frac12: { regex: /&(frac12|#0*189|#x0*[Bb][Dd]);/g, val: '\u00bd' },
  frac14: { regex: /&(frac14|#0*188|#x0*[Bb][Cc]);/g, val: '\u00bc' },
  frac34: { regex: /&(frac34|#0*190|#x0*[Bb][Ee]);/g, val: '\u00be' },
  inr: { regex: /&(inr|#0*8377);/g, val: "₹" },
};

/**
 * Currency symbol entities.
 */
export const CURRENCY_ENTITIES = {
  cent: { regex: /&(cent|#0*162|#x0*[Aa]2);/g, val: '\u00a2' },
  pound: { regex: /&(pound|#0*163|#x0*[Aa]3);/g, val: '\u00a3' },
  yen: { regex: /&(yen|#0*165|#x0*[Aa]5);/g, val: '\u00a5' },
  euro: { regex: /&(euro|#0*8364|#x0*20[Aa][Cc]);/g, val: '\u20ac' },
  inr: { regex: /&(inr|#0*8377|#x0*20[Bb]9);/g, val: '\u20b9' },
  curren: { regex: /&(curren|#0*164|#x0*[Aa]4);/g, val: '\u00a4' },
  fnof: { regex: /&(fnof|#0*402|#x0*192);/g, val: '\u0192' },
};

/**
 * Mathematical operator entities.
 */
export const MATH_ENTITIES = {
  times: { regex: /&(times|#0*215|#x0*[Dd]7);/g, val: '\u00d7' },
  divide: { regex: /&(divide|#0*247|#x0*[Ff]7);/g, val: '\u00f7' },
  plusmn: { regex: /&(plusmn|#0*177|#x0*[Bb]1);/g, val: '\u00b1' },
  minus: { regex: /&(minus|#0*8722|#x0*2212);/g, val: '\u2212' },
  sup2: { regex: /&(sup2|#0*178|#x0*[Bb]2);/g, val: '\u00b2' },
  sup3: { regex: /&(sup3|#0*179|#x0*[Bb]3);/g, val: '\u00b3' },
  sup1: { regex: /&(sup1|#0*185|#x0*[Bb]9);/g, val: '\u00b9' },
  frac12: { regex: /&(frac12|#0*189|#x0*[Bb][Dd]);/g, val: '\u00bd' },
  frac14: { regex: /&(frac14|#0*188|#x0*[Bb][Cc]);/g, val: '\u00bc' },
  frac34: { regex: /&(frac34|#0*190|#x0*[Bb][Ee]);/g, val: '\u00be' },
  permil: { regex: /&(permil|#0*8240|#x0*2030);/g, val: '\u2030' },
  infin: { regex: /&(infin|#0*8734|#x0*221[Ee]);/g, val: '\u221e' },
  sum: { regex: /&(sum|#0*8721|#x0*2211);/g, val: '\u2211' },
  prod: { regex: /&(prod|#0*8719|#x0*220[Ff]);/g, val: '\u220f' },
  radic: { regex: /&(radic|#0*8730|#x0*221[Aa]);/g, val: '\u221a' },
  ne: { regex: /&(ne|#0*8800|#x0*2260);/g, val: '\u2260' },
  le: { regex: /&(le|#0*8804|#x0*2264);/g, val: '\u2264' },
  ge: { regex: /&(ge|#0*8805|#x0*2265);/g, val: '\u2265' },
};

/**
 * Arrow entities.
 */
export const ARROW_ENTITIES = {
  larr: { regex: /&(larr|#0*8592|#x0*2190);/g, val: '\u2190' },
  uarr: { regex: /&(uarr|#0*8593|#x0*2191);/g, val: '\u2191' },
  rarr: { regex: /&(rarr|#0*8594|#x0*2192);/g, val: '\u2192' },
  darr: { regex: /&(darr|#0*8595|#x0*2193);/g, val: '\u2193' },
  harr: { regex: /&(harr|#0*8596|#x0*2194);/g, val: '\u2194' },
  lArr: { regex: /&(lArr|#0*8656|#x0*21[Dd]0);/g, val: '\u21d0' },
  uArr: { regex: /&(uArr|#0*8657|#x0*21[Dd]1);/g, val: '\u21d1' },
  rArr: { regex: /&(rArr|#0*8658|#x0*21[Dd]2);/g, val: '\u21d2' },
  dArr: { regex: /&(dArr|#0*8659|#x0*21[Dd]3);/g, val: '\u21d3' },
  hArr: { regex: /&(hArr|#0*8660|#x0*21[Dd]4);/g, val: '\u21d4' },
};

/**
 * Numeric character references — decimal &#NNN; and hex &#xHH;
 * These are function-replacers; they expand any valid code point.
 */
export const NUMERIC_ENTITIES = {
  num_dec: {
    regex: /&#0*([0-9]{1,7});/g,
    val: (_, s) => fromCodePoint(s, 10, "&#"),
  },
  num_hex: {
    regex: /&#x0*([0-9a-fA-F]{1,6});/g,
    val: (_, s) => fromCodePoint(s, 16, "&#x"),
  },
};

function fromCodePoint(str, base, prefix) {
  const codePoint = Number.parseInt(str, base);

  if (codePoint >= 0 && codePoint <= 0x10FFFF) {
    return String.fromCodePoint(codePoint);
  } else {
    return prefix + str + ";";
  }
}