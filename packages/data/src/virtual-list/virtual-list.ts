/** A rendered row in a virtual list, with its logical position and measured size. */
export interface VirtualListItem {
  index: number;
  start: number;
  size: number;
}

/** The visible range and the rows needed to paint it, including overscan. */
export interface VirtualListWindow {
  start: number;
  end: number;
  totalSize: number;
  items: VirtualListItem[];
}

export interface VirtualListOptions {
  count: number;
  /** Positive fallback height used until a row has been measured. */
  estimateSize: number;
  /** Rows to render before and after the viewport. Defaults to 3. */
  overscan?: number;
}

export interface VirtualList {
  readonly count: number;
  readonly totalSize: number;
  /** Update the item count. Measurements beyond the new end are discarded. */
  resize(count: number): void;
  /** Record a row's measured height; returns false for invalid indices or sizes. */
  measure(index: number, size: number): boolean;
  /** Return the measured height or the estimate for an item. */
  sizeOf(index: number): number;
  /** Return the item's start offset. `offsetOf(count)` is the total size. */
  offsetOf(index: number): number;
  /** Return the item at an offset, clamped to the current list. */
  indexAt(offset: number): number;
  /** Return the viewport range and its bounded overscan rows. */
  window(scrollOffset: number, viewportSize: number, overscan?: number): VirtualListWindow;
}

function normalizeCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function normalizePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Create a variable-height virtual list with O(log n) offset, lookup and
 * measurement updates. Heights are estimated until the caller measures rows.
 */
export function createVirtualList(options: VirtualListOptions): VirtualList {
  const estimate = normalizePositive(options.estimateSize, 1);
  const defaultOverscan = Number.isFinite(options.overscan)
    ? Math.max(0, Math.floor(options.overscan ?? 0))
    : 3;
  let itemCount = normalizeCount(options.count);
  const measured = new Map<number, number>();
  let tree: number[] = [];
  let total = 0;

  function rebuild(): void {
    tree = new Array<number>(itemCount + 1).fill(0);
    total = 0;
    for (let index = 0; index < itemCount; index += 1) {
      const delta = (measured.get(index) ?? estimate) - estimate;
      total += estimate + delta;
      for (let cursor = index + 1; cursor <= itemCount; cursor += cursor & -cursor) {
        tree[cursor] = (tree[cursor] ?? 0) + delta;
      }
    }
  }

  function prefixDelta(end: number): number {
    let sum = 0;
    for (let cursor = end; cursor > 0; cursor -= cursor & -cursor) {
      sum += tree[cursor] ?? 0;
    }
    return sum;
  }

  function offsetOf(index: number): number {
    const end = Math.min(itemCount, Math.max(0, Math.floor(Number.isFinite(index) ? index : 0)));
    return end * estimate + prefixDelta(end);
  }

  rebuild();

  return {
    get count() {
      return itemCount;
    },
    get totalSize() {
      return total;
    },
    resize(count) {
      itemCount = normalizeCount(count);
      for (const index of measured.keys()) {
        if (index >= itemCount) measured.delete(index);
      }
      rebuild();
    },
    measure(index, size) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= itemCount ||
        !Number.isFinite(size) ||
        size <= 0
      ) {
        return false;
      }
      const previous = measured.get(index) ?? estimate;
      if (previous === size) return true;
      measured.set(index, size);
      const delta = size - previous;
      total += delta;
      for (let cursor = index + 1; cursor <= itemCount; cursor += cursor & -cursor) {
        tree[cursor] = (tree[cursor] ?? 0) + delta;
      }
      return true;
    },
    sizeOf(index) {
      if (!Number.isInteger(index) || index < 0 || index >= itemCount) return 0;
      return measured.get(index) ?? estimate;
    },
    offsetOf,
    indexAt(offset) {
      if (itemCount === 0) return 0;
      const target = Number.isFinite(offset) ? Math.max(0, offset) : 0;
      if (target >= total) return itemCount - 1;
      let index = 0;
      let accumulated = 0;
      let bit = 1;
      while (bit * 2 <= itemCount) bit *= 2;
      for (; bit > 0; bit = Math.floor(bit / 2)) {
        const next = index + bit;
        if (next <= itemCount) {
          const candidate = accumulated + (tree[next] ?? 0) + bit * estimate;
          if (candidate <= target) {
            index = next;
            accumulated = candidate;
          }
        }
      }
      return Math.min(index, itemCount - 1);
    },
    window(scrollOffset, viewportSize, overscan = defaultOverscan) {
      if (itemCount === 0 || !Number.isFinite(viewportSize) || viewportSize <= 0) {
        return { start: 0, end: 0, totalSize: total, items: [] };
      }
      const from = Number.isFinite(scrollOffset) ? Math.max(0, scrollOffset) : 0;
      const first = this.indexAt(from);
      const exclusiveEnd = from + viewportSize;
      const tolerance = Math.max(1, Math.abs(exclusiveEnd)) * Number.EPSILON * 2;
      const last = this.indexAt(Math.max(from, exclusiveEnd - tolerance));
      const extra = Number.isFinite(overscan) ? Math.max(0, Math.floor(overscan)) : 0;
      const start = Math.max(0, first - extra);
      const end = Math.min(itemCount, last + 1 + extra);
      const items: VirtualListItem[] = [];
      for (let index = start; index < end; index += 1) {
        items.push({ index, start: offsetOf(index), size: measured.get(index) ?? estimate });
      }
      return { start, end, totalSize: total, items };
    },
  };
}

export type VirtualListKey =
  | 'ArrowDown'
  | 'ArrowUp'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'PageDown'
  | 'PageUp';
export type VirtualListDirection = 'ltr' | 'rtl';
export type VirtualListOrientation = 'vertical' | 'horizontal';

export interface VirtualListNavigationOptions {
  count: number;
  orientation?: VirtualListOrientation;
  direction?: VirtualListDirection;
  pageSize?: number;
  loop?: boolean;
}

/** Resolve a keyboard move to a logical item index; return null for unrelated keys. */
export function nextVirtualListIndex(
  currentIndex: number,
  key: string,
  options: VirtualListNavigationOptions
): number | null {
  const count = normalizeCount(options.count);
  if (count === 0) return null;
  const orientation = options.orientation ?? 'vertical';
  const direction = options.direction ?? 'ltr';
  const current = Math.min(
    count - 1,
    Math.max(0, Math.floor(Number.isFinite(currentIndex) ? currentIndex : 0))
  );
  let delta = 0;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (orientation === 'vertical' && key === 'ArrowDown') delta = 1;
  else if (orientation === 'vertical' && key === 'ArrowUp') delta = -1;
  else if (orientation === 'horizontal' && key === 'ArrowRight')
    delta = direction === 'rtl' ? -1 : 1;
  else if (orientation === 'horizontal' && key === 'ArrowLeft')
    delta = direction === 'rtl' ? 1 : -1;
  else if (key === 'PageDown') delta = Math.max(1, Math.floor(options.pageSize ?? 10));
  else if (key === 'PageUp') delta = -Math.max(1, Math.floor(options.pageSize ?? 10));
  else return null;
  const next = current + delta;
  if (options.loop) return ((next % count) + count) % count;
  return Math.min(count - 1, Math.max(0, next));
}
