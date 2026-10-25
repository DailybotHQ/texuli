import type { ComboboxItemData } from './context.ts';

/**
 * Decides whether an item matches the query. `Combobox.Root` calls it for each
 * item when the trimmed query is not empty, with that trimmed query; an empty
 * query shows every item. A `filter` replaces the default label match; it is
 * never combined with it.
 */
export type ComboboxFilter = (item: ComboboxItemData, query: string) => boolean;

/**
 * The default filter: the item's label contains the query, ignoring case in
 * the user's locale (no accent folding).
 */
export const defaultComboboxFilter: ComboboxFilter = (item, query) =>
  item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase());

/**
 * Folds text for accent-insensitive search: lower case in `locale` (the
 * user's locale when omitted), canonical decomposition (NFD), then combining
 * marks removed. `"São Paulo"` and `"sao paulo"` fold to the same text.
 * Lower-casing first keeps locale rules intact: Turkish `"İ"` becomes `"i"`,
 * not a dotless `"ı"`.
 */
export function foldSearchText(text: string, locale?: string | readonly string[]): string {
  return text
    .toLocaleLowerCase(locale as string | string[] | undefined)
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export interface FoldedFilterOptions {
  /**
   * The texts an item is searched by. Default: its label. Add the value to
   * find `America/New_York` by typing `new_york`.
   */
  fields?: (item: ComboboxItemData) => readonly string[];
  /** Locale for lower-casing (the user's locale when omitted). */
  locale?: string | readonly string[];
}

/**
 * Builds an accent-insensitive filter: an item matches when any of its
 * `fields` contains the folded query. Pass it as `Combobox.Root`'s `filter`.
 *
 * @example
 * filter={createFoldedFilter({ fields: (item) => [item.label, item.value] })}
 */
export function createFoldedFilter(options: FoldedFilterOptions = {}): ComboboxFilter {
  const fields = options.fields ?? ((item: ComboboxItemData) => [item.label]);
  return (item, query) => {
    const needle = foldSearchText(query, options.locale);
    return fields(item).some((field) => foldSearchText(field, options.locale).includes(needle));
  };
}
