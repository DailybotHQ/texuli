/** Where a group keeps its layout between visits: `localStorage` fits, or any object with these two methods. */
export type SplitterStorage = Pick<Storage, 'getItem' | 'setItem'>;

const key = (id: string) => `texuli-splitter:${id}`;

/** A saved layout, or null when there is none or it is not a list of numbers. Never throws. */
export function loadLayout(
  storage: SplitterStorage | undefined,
  id: string | undefined
): number[] | null {
  try {
    const parsed: unknown = id && JSON.parse(storage?.getItem(key(id)) ?? 'null');
    return Array.isArray(parsed) && parsed.every(Number.isFinite) ? parsed : null;
  } catch {
    return null;
  }
}

/** Saves a layout; a missing, full or blocked storage is ignored (persistence is best effort). */
export function saveLayout(
  storage: SplitterStorage | undefined,
  id: string | undefined,
  layout: readonly number[]
): void {
  try {
    if (id) storage?.setItem(key(id), JSON.stringify(layout));
  } catch {}
}
