/**
 * The standard 14 fonts the PDF writer uses (Helvetica in four styles and
 * Courier), with WinAnsi encoding and the advance widths of the Adobe
 * Font Metrics files (thousandths of the font size). Text outside WinAnsi
 * goes to the host's TrueType font when there is one (`truetype.ts`).
 */

export type StandardFont = 'F1' | 'F2' | 'F3' | 'F4' | 'F5';

/** Resource name to base font. */
export const STANDARD_FONTS: Readonly<Record<StandardFont, string>> = Object.freeze({
  F1: 'Helvetica',
  F2: 'Helvetica-Bold',
  F3: 'Helvetica-Oblique',
  F4: 'Helvetica-BoldOblique',
  F5: 'Courier',
});

export function standardFont(style: {
  strong?: boolean;
  em?: boolean;
  code?: boolean;
}): StandardFont {
  if (style.code) return 'F5';
  if (style.strong) return style.em ? 'F4' : 'F2';
  return style.em ? 'F3' : 'F1';
}

// Widths for codes 32..255. Expanded from runs: `n*w` repeats w n times.
function expand(source: string): Uint16Array {
  const out: number[] = [];
  for (const token of source.split(' ')) {
    const star = token.indexOf('*');
    if (star < 0) out.push(Number(token));
    else
      for (let i = Number(token.slice(0, star)); i > 0; i -= 1)
        out.push(Number(token.slice(star + 1)));
  }
  return Uint16Array.from(out);
}

/* biome-ignore format: metric tables */
const HELVETICA = expand(
  '278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 10*556 278 278 584 584 584 556 1015 ' +
  '667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 ' +
  '278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 ' +
  '556 500 722 500 500 500 334 260 334 584 0 ' +
  '556 0 222 556 333 1000 556 556 333 1000 667 333 1000 0 611 0 0 222 222 333 333 350 556 1000 333 1000 500 333 944 0 500 667 ' +
  '278 333 556 556 556 556 260 556 333 737 370 556 584 333 737 333 400 584 333 333 333 556 537 278 333 333 365 556 834 834 834 611 ' +
  '6*667 1000 722 4*667 4*278 722 722 5*778 584 778 4*722 667 667 611 ' +
  '6*556 889 500 4*556 4*278 556 556 5*556 584 611 4*556 500 556 500'
);

/* biome-ignore format: metric tables */
const HELVETICA_BOLD = expand(
  '278 333 474 556 556 889 722 238 333 333 389 584 278 333 278 278 10*556 333 333 584 584 584 611 975 ' +
  '722 722 722 722 667 611 778 722 278 556 722 611 833 722 778 667 778 722 667 611 722 667 944 667 667 611 ' +
  '333 278 333 584 556 333 556 611 556 611 556 333 611 611 278 278 556 278 889 611 611 611 611 389 556 333 ' +
  '611 556 778 556 556 500 389 280 389 584 0 ' +
  '556 0 278 556 500 1000 556 556 333 1000 667 333 1000 0 611 0 0 278 278 500 500 350 556 1000 333 1000 556 333 944 0 500 667 ' +
  '278 333 556 556 556 556 280 556 333 737 370 556 584 333 737 333 400 584 333 333 333 611 556 278 333 333 365 556 834 834 834 611 ' +
  '6*722 1000 722 4*667 4*278 722 722 5*778 584 778 4*722 667 667 611 ' +
  '6*556 889 556 4*556 4*278 611 611 5*611 584 611 4*611 556 611 556'
);

/** Unicode code points WinAnsi places at 0x80..0x9F. */
const WIN_ANSI_HIGH: Readonly<Record<number, number>> = Object.freeze({
  8364: 0x80,
  8218: 0x82,
  402: 0x83,
  8222: 0x84,
  8230: 0x85,
  8224: 0x86,
  8225: 0x87,
  710: 0x88,
  8240: 0x89,
  352: 0x8a,
  8249: 0x8b,
  338: 0x8c,
  381: 0x8e,
  8216: 0x91,
  8217: 0x92,
  8220: 0x93,
  8221: 0x94,
  8226: 0x95,
  8211: 0x96,
  8212: 0x97,
  732: 0x98,
  8482: 0x99,
  353: 0x9a,
  8250: 0x9b,
  339: 0x9c,
  382: 0x9e,
  376: 0x9f,
});

/** The WinAnsi byte for a code point, or -1 when WinAnsi has no such character. */
export function winAnsiCode(codePoint: number): number {
  if ((codePoint >= 0x20 && codePoint <= 0x7e) || (codePoint >= 0xa0 && codePoint <= 0xff))
    return codePoint;
  return WIN_ANSI_HIGH[codePoint] ?? -1;
}

/** Advance width of a WinAnsi byte in thousandths of the font size. */
export function standardWidth(font: StandardFont, code: number): number {
  if (font === 'F5') return 600;
  const table = font === 'F2' || font === 'F4' ? HELVETICA_BOLD : HELVETICA;
  return table[code - 32] ?? 556;
}
