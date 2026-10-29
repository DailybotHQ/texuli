/**
 * The paged view's strings. Hosts pass a partial object to translate;
 * functions build sentences so word order stays the translator's.
 */
export interface PagedLabels {
  /** The paged view's name when the document has no title. */
  paged: string;
  /** A page's accessible name. */
  pageOf: (page: number, total: number) => string;
  /** Announced while pages are laid out. */
  paginating: string;
}

export const DEFAULT_PAGED_LABELS: PagedLabels = {
  paged: 'Pages',
  pageOf: (page, total) => `Page ${page} of ${total}`,
  paginating: 'Laying out pages…',
};

/** Merge partial labels over the English defaults; empty values never replace a default. */
export function resolvePagedLabels(overrides?: Partial<PagedLabels>): PagedLabels {
  const out: PagedLabels = { ...DEFAULT_PAGED_LABELS };
  if (!overrides) return out;
  for (const key of Object.keys(DEFAULT_PAGED_LABELS) as (keyof PagedLabels)[]) {
    const value = overrides[key];
    if (value !== undefined && value !== null && value !== '') {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
