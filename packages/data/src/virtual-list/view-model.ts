/**
 * The plain model behind `VirtualListView`: its closed size and density
 * lists, the viewport height it assumes before measuring (and on the
 * server), and the default key, label and description readers. Framework
 * free, so the catalog and tests can read the same lists.
 */

/** Viewport heights: three fixed heights, or the parent's height. */
export const VIRTUAL_LIST_SIZES = ['sm', 'md', 'lg', 'fill'] as const;
export type VirtualListViewSize = (typeof VIRTUAL_LIST_SIZES)[number];

/** Row padding steps. */
export const VIRTUAL_LIST_DENSITIES = ['compact', 'default', 'comfortable'] as const;
export type VirtualListViewDensity = (typeof VIRTUAL_LIST_DENSITIES)[number];

/** A row key: what `selected` holds. */
export type VirtualListKeyValue = string | number;

/** What the `row` snippet receives. */
export interface VirtualListRowContext<T> {
  item: T;
  index: number;
  /** The keyboard's active row (`aria-activedescendant`). */
  active: boolean;
  selected: boolean;
}

/**
 * Viewport height in px assumed until the viewport is measured, and during
 * server rendering, so the first window is painted before hydration. These
 * match the CSS block sizes (16, 24 and 36 rem at 16 px; `fill` assumes 30).
 */
const FALLBACK: Readonly<Record<VirtualListViewSize, number>> = {
  sm: 256,
  md: 384,
  lg: 576,
  fill: 480,
};

export function normalizeVirtualListSize(value: unknown): VirtualListViewSize {
  return (VIRTUAL_LIST_SIZES as readonly unknown[]).includes(value)
    ? (value as VirtualListViewSize)
    : 'md';
}

export function normalizeVirtualListDensity(value: unknown): VirtualListViewDensity {
  return (VIRTUAL_LIST_DENSITIES as readonly unknown[]).includes(value)
    ? (value as VirtualListViewDensity)
    : 'default';
}

export function viewportFallback(size: VirtualListViewSize): number {
  return FALLBACK[size];
}

function field(item: unknown, name: string): unknown {
  return typeof item === 'object' && item !== null && Object.hasOwn(item, name)
    ? (item as Record<string, unknown>)[name]
    : undefined;
}

/** `item.id` when it is a string or a finite number, else the index. */
export function virtualListKeyOf(item: unknown, index: number): VirtualListKeyValue {
  const id = field(item, 'id');
  return typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id)) ? id : index;
}

/** `item.label`, a string or number item itself, else "Item n". Text only. */
export function virtualListLabelOf(item: unknown, index: number): string {
  const label = field(item, 'label');
  if (typeof label === 'string') return label;
  if (typeof item === 'string') return item;
  if (typeof item === 'number' && Number.isFinite(item)) return String(item);
  return `Item ${index + 1}`;
}

/** `item.description` when it is a non-empty string. Text only. */
export function virtualListDescriptionOf(item: unknown): string | undefined {
  const description = field(item, 'description');
  return typeof description === 'string' && description.length > 0 ? description : undefined;
}
