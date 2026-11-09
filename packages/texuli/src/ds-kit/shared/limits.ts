/**
 * What the kit renders at most, and the text helpers every section uses. The document is
 * untrusted data (ADR-032): the kit clips what it shows and renders text as text nodes only.
 */

export const KIT_LIMITS = Object.freeze({
  /** Characters of one text value. */
  textChars: 2000,
  /** Items of one list. */
  listItems: 100,
  /** Rows of the voice lexicon. */
  lexiconRows: 200,
  /** Library entries. */
  libraryEntries: 64,
  /** Catalog components in the matrix. */
  components: 256,
  /** Live samples per component in the full matrix. */
  cellsPerComponent: 128,
  /** Tokens of one mode in the foundations. */
  tokens: 1024,
});

/** A string as the kit shows it: other values give `undefined`, long ones are clipped. */
export function kitText(
  value: unknown,
  max: number = KIT_LIMITS.textChars
): { text: string; clipped: boolean } | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length > max
    ? { text: value.slice(0, max), clipped: true }
    : { text: value, clipped: false };
}

/** A stable `id` fragment: lowercase letters, digits and single hyphens, at most 64 characters. */
export function kitIdPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'item'
  );
}
