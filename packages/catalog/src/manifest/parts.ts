/**
 * Catalog part → parent ids: an id that starts with another catalog id plus
 * `-` is a part of that parent (`list-item` → `list`, `select-trigger` →
 * `select`, `data-dashboard-widget` → `data-dashboard`). Longest parent wins.
 * Used by the locked render mapper; the catalog is the source of the id list.
 */
export function partParentMap(ids: readonly string[]): Readonly<Record<string, string>> {
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))].sort(
    (a, b) => b.length - a.length
  );
  const map: Record<string, string> = {};
  for (const id of unique) {
    for (const parent of unique) {
      if (parent.length >= id.length) continue;
      if (id.startsWith(`${parent}-`)) {
        map[id] = parent;
        break;
      }
    }
  }
  return map;
}
