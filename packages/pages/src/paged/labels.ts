import { englishMessages, type MessageLookup } from '@texuli/core/i18n';

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

/** The paged labels for one message lookup (ids `pages.paged.<key>`, ADR-026). */
export function pagedLabelsFor(messages: MessageLookup): PagedLabels {
  return {
    paged: messages('pages.paged.paged', 'Pages'),
    pageOf: (page, total) =>
      messages('pages.paged.page-of', 'Page {page} of {total}', { page, total }),
    paginating: messages('pages.paged.paginating', 'Laying out pages…'),
  };
}

export const DEFAULT_PAGED_LABELS: PagedLabels = pagedLabelsFor(englishMessages);

/** Merge partial labels over the English defaults; empty values never replace a default. */
export function resolvePagedLabels(
  overrides?: Partial<PagedLabels>,
  defaults: PagedLabels = DEFAULT_PAGED_LABELS
): PagedLabels {
  const out: PagedLabels = { ...defaults };
  if (!overrides) return out;
  for (const key of Object.keys(DEFAULT_PAGED_LABELS) as (keyof PagedLabels)[]) {
    const value = overrides[key];
    if (value !== undefined && value !== null && value !== '') {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
