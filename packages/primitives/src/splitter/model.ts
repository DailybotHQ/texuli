/**
 * The splitter's layout math: pure functions, sizes in percent of the group.
 * A layout is one size per pane, in order, summing to 100.
 */

export interface PaneConstraints {
  /** Starting size in percent; panes without one share what is left. */
  defaultSize?: number;
  /** Smallest size in percent while expanded. Default 0. */
  minSize?: number;
  /** Largest size in percent. Default 100. */
  maxSize?: number;
  /** Whether dragging or Enter can collapse the pane below `minSize`. */
  collapsible?: boolean;
  /** Size in percent while collapsed. Default 0. */
  collapsedSize?: number;
}

interface Bounds {
  min: number;
  max: number;
  collapsible: boolean;
  collapsed: number;
}

const EPSILON = 1e-6;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export function paneBounds(pane: PaneConstraints = {}): Bounds {
  const min = clamp(finite(pane.minSize, 0), 0, 100);
  const max = clamp(finite(pane.maxSize, 100), min, 100);
  const collapsed = clamp(finite(pane.collapsedSize, 0), 0, min);
  return { min, max, collapsible: pane.collapsible === true, collapsed };
}

/** Whether a pane of this size is collapsed. */
export function isCollapsed(size: number, pane: PaneConstraints = {}): boolean {
  const bounds = paneBounds(pane);
  return bounds.collapsible && size <= bounds.collapsed + EPSILON && bounds.collapsed < bounds.min;
}

/** Fit one size to a pane: collapsed stays collapsed, else within min and max. */
function fit(size: number, bounds: Bounds): number {
  if (bounds.collapsible && size <= bounds.collapsed + EPSILON) return bounds.collapsed;
  return clamp(size, bounds.min, bounds.max);
}

/**
 * Makes any layout valid for these panes: every size within its pane's
 * bounds, the sum 100. The remainder is spread over panes that can still
 * grow (or shrink), last pane first, so constraints win over the requested
 * sizes. A collapsed pane takes slack only when no open pane can.
 */
export function normalizeLayout(
  layout: readonly number[],
  panes: readonly PaneConstraints[]
): number[] {
  const bounds = panes.map((pane) => paneBounds(pane));
  const sizes = bounds.map((bound, index) => fit(finite(layout[index], 0), bound));
  let remainder = 100 - sizes.reduce((sum, size) => sum + size, 0);
  // Last pane first (the content pane usually takes the slack); collapsed panes only if needed.
  for (let step = 0; step < sizes.length * 2 && Math.abs(remainder) > EPSILON; step += 1) {
    const index = sizes.length - 1 - (step % sizes.length);
    const bound = bounds[index] as Bounds;
    const size = sizes[index] as number;
    if (step < sizes.length && bound.collapsible && size <= bound.collapsed + EPSILON) continue;
    const next = clamp(size + remainder, bound.min, bound.max);
    remainder -= next - size;
    sizes[index] = next;
  }
  return sizes;
}

/**
 * The starting layout: each pane's `defaultSize`, the rest shared equally by
 * panes without one, then normalized. A saved layout of the right length wins.
 */
export function initialLayout(
  panes: readonly PaneConstraints[],
  saved?: readonly number[] | null
): number[] {
  if (
    saved &&
    saved.length === panes.length &&
    saved.every((size) => typeof size === 'number' && Number.isFinite(size))
  ) {
    return normalizeLayout(saved, panes);
  }
  const fixed = panes.reduce((sum, pane) => sum + finite(pane.defaultSize, 0), 0);
  const open = panes.filter((pane) => !Number.isFinite(pane.defaultSize)).length;
  const share = open > 0 ? Math.max(0, 100 - fixed) / open : 0;
  return normalizeLayout(
    panes.map((pane) => finite(pane.defaultSize, share)),
    panes
  );
}

/**
 * Moves the handle between pane `index` and pane `index + 1` by `delta`
 * percent (positive grows the first). Only those two panes change. A pane
 * pushed below its minimum collapses when it is collapsible and the push
 * passes halfway to its collapsed size; otherwise it stops at its minimum.
 * A collapsed pane pulled open expands to at least its minimum. When the
 * other pane cannot follow (its own limits), nothing moves.
 */
export function resizeLayout(
  layout: readonly number[],
  index: number,
  delta: number,
  panes: readonly PaneConstraints[]
): number[] {
  const next = [...layout];
  if (index < 0 || index + 1 >= layout.length || !Number.isFinite(delta) || delta === 0) {
    return next;
  }
  // One routine: `grow` takes `amount` from `shrink`. A negative delta swaps them.
  const [g, s] = delta > 0 ? [index, index + 1] : [index + 1, index];
  const grow = paneBounds(panes[g]);
  const shrink = paneBounds(panes[s]);
  const total = (layout[g] as number) + (layout[s] as number);
  const amount = Math.abs(delta);
  let shrunk = (layout[s] as number) - amount;
  if (shrunk < shrink.min) {
    shrunk =
      shrink.collapsible && shrunk < (shrink.min + shrink.collapsed) / 2
        ? shrink.collapsed
        : shrink.min;
  }
  let grown = total - shrunk;
  // A collapsed pane opens to at least its minimum.
  if (grow.collapsible && (layout[g] as number) <= grow.collapsed + EPSILON && grown < grow.min) {
    grown = Math.max(grow.min, (layout[g] as number) + amount);
    shrunk = total - grown;
  }
  if (grown > grow.max) {
    grown = grow.max;
    shrunk = total - grown;
  }
  if (fit(grown, grow) !== grown || fit(shrunk, shrink) !== shrunk) return next;
  next[g] = grown;
  next[s] = shrunk;
  return next;
}

/**
 * Sets pane `index` to `size` (clamped) by moving the handle after it, or the
 * one before it for the last pane.
 */
export function setPaneSize(
  layout: readonly number[],
  index: number,
  size: number,
  panes: readonly PaneConstraints[]
): number[] {
  const current = layout[index];
  if (current === undefined) return [...layout];
  if (index < layout.length - 1) return resizeLayout(layout, index, size - current, panes);
  return resizeLayout(layout, index - 1, current - size, panes);
}

export type SplitterDirection = 'horizontal' | 'vertical';

export interface KeyResizeOptions {
  /** `horizontal`: panes side by side (a vertical splitter). */
  direction: SplitterDirection;
  /** Right to left: in a horizontal group the first pane is on the right. */
  rtl?: boolean;
  /** Percent per arrow press. Default 10. */
  step?: number;
}

/**
 * The layout after a key on the handle between pane `index` and `index + 1`
 * (WAI-ARIA APG window splitter): the arrows on the group's axis move the
 * handle the way they point (mirrored in right to left), Home gives the first
 * pane its minimum and End its maximum. Returns null for keys the handle does
 * not own. Enter (collapse and restore) needs the remembered size, so the
 * handle does it with `toggleCollapse`.
 */
export function layoutForKey(
  key: string,
  layout: readonly number[],
  index: number,
  panes: readonly PaneConstraints[],
  options: KeyResizeOptions
): number[] | null {
  const step = finite(options.step, 10);
  const horizontal = options.direction === 'horizontal';
  const forward = horizontal ? (options.rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
  const backward = horizontal ? (options.rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
  const first = paneBounds(panes[index]);
  const current = layout[index] ?? 0;
  switch (key) {
    case forward:
      return resizeLayout(layout, index, step, panes);
    case backward:
      return resizeLayout(layout, index, -step, panes);
    case 'Home':
      return resizeLayout(layout, index, first.min - current, panes);
    case 'End':
      return resizeLayout(layout, index, first.max - current, panes);
    default:
      return null;
  }
}

/**
 * Collapses pane `index` if it is open, or restores it to `restoreSize`
 * (else its minimum) if it is collapsed. A pane that is not collapsible does
 * not change. Returns the layout and the size to restore next time.
 */
export function toggleCollapse(
  layout: readonly number[],
  index: number,
  panes: readonly PaneConstraints[],
  restoreSize?: number
): { layout: number[]; restoreSize: number | undefined } {
  const pane = panes[index];
  const bounds = paneBounds(pane);
  const current = layout[index];
  if (!bounds.collapsible || current === undefined) return { layout: [...layout], restoreSize };
  if (isCollapsed(current, pane)) {
    const target = Math.max(bounds.min, finite(restoreSize, bounds.min));
    return { layout: setPaneSize(layout, index, target, panes), restoreSize: undefined };
  }
  return { layout: setPaneSize(layout, index, bounds.collapsed, panes), restoreSize: current };
}
