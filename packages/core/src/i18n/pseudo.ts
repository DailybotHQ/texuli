/**
 * Pseudo-localization for coverage (ADR-016): accented, bracketed and
 * slightly longer text, so a label that skipped the catalog (still plain
 * English) or a layout that clips longer translations stands out. `{name}`
 * placeholders are kept as is.
 */
const ACCENTS: Readonly<Record<string, string>> = {
  a: 'á',
  c: 'ç',
  e: 'é',
  i: 'í',
  n: 'ñ',
  o: 'ó',
  u: 'ú',
  y: 'ý',
  A: 'Á',
  C: 'Ç',
  E: 'É',
  I: 'Í',
  N: 'Ñ',
  O: 'Ó',
  U: 'Ú',
  Y: 'Ý',
};

/** The pseudo form of `text`: `⟦Çlóśé⟧`-style, linear in the length of the text. */
export function pseudoLocalize(text: string): string {
  let out = '';
  let inPlaceholder = false;
  for (const char of text) {
    if (char === '{') inPlaceholder = true;
    else if (char === '}') inPlaceholder = false;
    out += inPlaceholder ? char : (ACCENTS[char] ?? char);
  }
  return `⟦${out}⟧`;
}

/** Whether `text` is pseudo-localized (starts with `⟦` and ends with `⟧`). */
export function isPseudoLocalized(text: string): boolean {
  return text.startsWith('⟦') && text.endsWith('⟧');
}
