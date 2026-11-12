/**
 * HTML character references for the DOM-free reader. Numeric references are decoded in full
 * (zero, surrogates and values past U+10FFFF become U+FFFD, as browsers do); named references
 * cover the common set plus every name used to obfuscate a URL scheme (`&colon;`, `&Tab;`,
 * `&NewLine;`, `&sol;`…). An unknown name stays literal text; since every writer escapes `&`,
 * a literal reference can never decode later in a browser.
 */

const cp = String.fromCodePoint;

const NAMED: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  AMP: '&',
  lt: '<',
  LT: '<',
  gt: '>',
  GT: '>',
  quot: '"',
  QUOT: '"',
  apos: "'",
  nbsp: cp(0xa0),
  ensp: cp(0x2002),
  emsp: cp(0x2003),
  thinsp: cp(0x2009),
  shy: cp(0xad),
  zwj: cp(0x200d),
  zwnj: cp(0x200c),
  lrm: cp(0x200e),
  rlm: cp(0x200f),
  ndash: cp(0x2013),
  mdash: cp(0x2014),
  hellip: cp(0x2026),
  lsquo: cp(0x2018),
  rsquo: cp(0x2019),
  sbquo: cp(0x201a),
  ldquo: cp(0x201c),
  rdquo: cp(0x201d),
  bdquo: cp(0x201e),
  laquo: cp(0xab),
  raquo: cp(0xbb),
  bull: cp(0x2022),
  middot: cp(0xb7),
  copy: cp(0xa9),
  COPY: cp(0xa9),
  reg: cp(0xae),
  REG: cp(0xae),
  trade: cp(0x2122),
  deg: cp(0xb0),
  plusmn: cp(0xb1),
  times: cp(0xd7),
  divide: cp(0xf7),
  micro: cp(0xb5),
  para: cp(0xb6),
  sect: cp(0xa7),
  cent: cp(0xa2),
  pound: cp(0xa3),
  yen: cp(0xa5),
  euro: cp(0x20ac),
  iexcl: cp(0xa1),
  iquest: cp(0xbf),
  frac12: cp(0xbd),
  frac14: cp(0xbc),
  frac34: cp(0xbe),
  sup1: cp(0xb9),
  sup2: cp(0xb2),
  sup3: cp(0xb3),
  larr: cp(0x2190),
  uarr: cp(0x2191),
  rarr: cp(0x2192),
  darr: cp(0x2193),
  harr: cp(0x2194),
  hearts: cp(0x2665),
  check: cp(0x2713),
  // ASCII punctuation names (the ones scheme obfuscation uses).
  Tab: '\t',
  NewLine: '\n',
  excl: '!',
  num: '#',
  dollar: '$',
  percnt: '%',
  lpar: '(',
  rpar: ')',
  ast: '*',
  midast: '*',
  plus: '+',
  comma: ',',
  period: '.',
  sol: '/',
  colon: ':',
  semi: ';',
  equals: '=',
  quest: '?',
  commat: '@',
  lsqb: '[',
  lbrack: '[',
  bsol: '\\',
  rsqb: ']',
  rbrack: ']',
  Hat: '^',
  lowbar: '_',
  grave: '`',
  lcub: '{',
  lbrace: '{',
  verbar: '|',
  vert: '|',
  rcub: '}',
  rbrace: '}',
  tilde: cp(0x2dc),
});

/** Names browsers also decode without the closing `;` (the legacy set, the common part of it). */
const LEGACY = new Set([
  'amp',
  'AMP',
  'lt',
  'LT',
  'gt',
  'GT',
  'quot',
  'QUOT',
  'nbsp',
  'copy',
  'COPY',
  'reg',
  'REG',
]);

const REPLACEMENT = cp(0xfffd);

/** Windows-1252 code points browsers substitute for numeric references 0x80–0x9F. */
const C1: Readonly<Record<number, number>> = {
  128: 0x20ac,
  130: 0x201a,
  131: 0x192,
  132: 0x201e,
  133: 0x2026,
  134: 0x2020,
  135: 0x2021,
  136: 0x2c6,
  137: 0x2030,
  138: 0x160,
  139: 0x2039,
  140: 0x152,
  142: 0x17d,
  145: 0x2018,
  146: 0x2019,
  147: 0x201c,
  148: 0x201d,
  149: 0x2022,
  150: 0x2013,
  151: 0x2014,
  152: 0x2dc,
  153: 0x2122,
  154: 0x161,
  155: 0x203a,
  156: 0x153,
  158: 0x17e,
  159: 0x178,
};

// One pass, linear: digits and names are length-bounded, so no backtracking blow-up.
const REFERENCE = /&(?:#([0-9]{1,10})|#[xX]([0-9a-fA-F]{1,8})|([A-Za-z][A-Za-z0-9]{0,31}))(;?)/g;

function numeric(code: number): string {
  if (!Number.isFinite(code) || code === 0 || code > 0x10ffff) return REPLACEMENT;
  if (code >= 0xd800 && code <= 0xdfff) return REPLACEMENT;
  return cp(C1[code] ?? code);
}

/** Decode the character references in `text`. Never throws; unknown names stay literal. */
export function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(
    REFERENCE,
    (
      whole,
      decimal: string | undefined,
      hex: string | undefined,
      name: string | undefined,
      semi: string
    ) => {
      if (decimal !== undefined) return numeric(Number(decimal));
      if (hex !== undefined) return numeric(Number.parseInt(hex, 16));
      if (name === undefined || !Object.hasOwn(NAMED, name)) return whole;
      if (semi === '' && !LEGACY.has(name)) return whole;
      return NAMED[name] as string;
    }
  );
}
