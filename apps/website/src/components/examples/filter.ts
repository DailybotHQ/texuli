import type { ExampleCatalogItem } from './catalog.ts';

export interface ExampleFilterState {
  query: string;
  packageId: string | 'all';
  kind: string | 'all';
}

/** Pure filter for the examples browser (unit-tested). */
export function filterExampleCatalog(
  items: readonly ExampleCatalogItem[],
  state: ExampleFilterState
): readonly ExampleCatalogItem[] {
  const q = state.query.trim().toLowerCase();
  const words = q ? q.split(/\s+/).filter(Boolean) : [];
  return items.filter((item) => {
    if (state.packageId !== 'all' && item.packageId !== state.packageId) return false;
    if (state.kind !== 'all' && item.kind !== state.kind) return false;
    if (words.length === 0) return true;
    const hay = [
      item.id,
      item.title,
      item.description,
      item.component,
      item.packageId,
      item.kind,
      ...item.tags,
      ...item.props,
    ]
      .join(' ')
      .toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}
