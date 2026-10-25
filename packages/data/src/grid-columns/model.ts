import {
  type ColumnState,
  ColumnStateSchema,
  DEFAULT_COLUMN_WIDTH,
  type GridColumnDef,
  moveColumn,
  type ResolvedColumn,
  type ResolvedColumns,
  resizeColumn,
} from '../engines/grid/columns.ts';

/**
 * Framework-free column operations for the data grid (T-data-grid-columns),
 * on top of the grid engine's column state (`@texuli/data/grid`): ordering
 * inside pin zones, keyboard-sized resizing, pin offsets, visibility guards
 * and group header runs. Every function returns new state; none mutates.
 *
 * Pins are logical: the engine's `left` is the inline start and `right` the
 * inline end, so a right-to-left grid pins `left` columns on the right.
 */

/** A header spanning a set of columns (one level of grouping). */
export interface ColumnGroupDef {
  id: string;
  header: string;
  /** Keys of the columns under this header. A column belongs to one group. */
  columns: readonly string[];
}

export type PinZone = 'left' | 'center' | 'right';

/** One item of a column menu. */
export interface ColumnMenuAction {
  id: string;
  label: string;
  disabled?: boolean;
  /** Keep the menu open after this item (repeatable steps such as Wider). */
  keepOpen?: boolean;
}

/** Pixels a keyboard step changes a width by; `large` is the Shift step. */
export const RESIZE_STEP = Object.freeze({ small: 16, large: 64 });

/**
 * Untrusted (persisted) column state: valid state is returned as is, anything
 * else becomes `[]` (the definition order). It never throws.
 */
export function parseColumnState(input: unknown): ColumnState {
  const result = ColumnStateSchema.safeParse(input);
  return result.success ? result.data : [];
}

/**
 * State listing every column once: the state's order for known columns,
 * then any column it does not mention, in definition order. Duplicate and
 * unknown keys are dropped.
 */
export function completeState<T>(
  columns: readonly GridColumnDef<T>[],
  state: ColumnState
): ColumnState {
  const known = new Set(columns.map((column) => column.key));
  const seen = new Set<string>();
  const out: ColumnState = [];
  for (const entry of state) {
    if (!known.has(entry.key) || seen.has(entry.key)) continue;
    seen.add(entry.key);
    out.push({ ...entry });
  }
  for (const column of columns) if (!seen.has(column.key)) out.push({ key: column.key });
  return out;
}

/** Visible columns in screen order: start pins, unpinned, end pins. */
export function orderedColumns<T>(resolved: ResolvedColumns<T>): ResolvedColumn<T>[] {
  return [...resolved.left, ...resolved.center, ...resolved.right];
}

export function zoneOf<T>(column: ResolvedColumn<T>): PinZone {
  return column.pinned ?? 'center';
}

/**
 * Moves `key` next to `targetKey` in the state order. Both must be visible in
 * the same pin zone (a drag never crosses a pin boundary); otherwise the
 * state is returned unchanged.
 */
export function moveColumnTo<T>(
  columns: readonly GridColumnDef<T>[],
  resolved: ResolvedColumns<T>,
  state: ColumnState,
  key: string,
  targetKey: string,
  side: 'before' | 'after'
): ColumnState {
  if (key === targetKey) return state;
  const ordered = orderedColumns(resolved);
  const source = ordered.find((column) => column.def.key === key);
  const target = ordered.find((column) => column.def.key === targetKey);
  if (!source || !target || zoneOf(source) !== zoneOf(target)) return state;
  const full = completeState(columns, state);
  const without = full.filter((entry) => entry.key !== key);
  const at = without.findIndex((entry) => entry.key === targetKey);
  return moveColumn(full, key, side === 'before' ? at : at + 1);
}

/**
 * Moves a column one place earlier (`-1`) or later (`1`) among the visible
 * columns of its pin zone: the keyboard alternative to dragging.
 */
export function moveColumnBy<T>(
  columns: readonly GridColumnDef<T>[],
  resolved: ResolvedColumns<T>,
  state: ColumnState,
  key: string,
  delta: -1 | 1
): ColumnState {
  const ordered = orderedColumns(resolved);
  const source = ordered.find((column) => column.def.key === key);
  if (!source) return state;
  const zone = ordered.filter((column) => zoneOf(column) === zoneOf(source));
  const neighbor = zone[zone.indexOf(source) + delta];
  if (!neighbor) return state;
  return moveColumnTo(
    columns,
    resolved,
    state,
    key,
    neighbor.def.key,
    delta > 0 ? 'after' : 'before'
  );
}

/** Whether `moveColumnBy` can move the column in that direction. */
export function canMoveColumn<T>(
  resolved: ResolvedColumns<T>,
  key: string,
  delta: -1 | 1
): boolean {
  const ordered = orderedColumns(resolved);
  const source = ordered.find((column) => column.def.key === key);
  if (!source) return false;
  const zone = ordered.filter((column) => zoneOf(column) === zoneOf(source));
  return zone[zone.indexOf(source) + delta] !== undefined;
}

/** The column's current width (state, definition, or the default), clamped. */
export function columnWidth<T>(resolved: ResolvedColumns<T>, key: string): number {
  return (
    orderedColumns(resolved).find((column) => column.def.key === key)?.width ?? DEFAULT_COLUMN_WIDTH
  );
}

/** Widens (positive `delta`) or narrows a column by pixels, within its min and max. */
export function resizeColumnBy<T>(
  columns: readonly GridColumnDef<T>[],
  resolved: ResolvedColumns<T>,
  state: ColumnState,
  key: string,
  delta: number
): ColumnState {
  if (!Number.isFinite(delta)) return state;
  return resizeColumn(state, columns, key, columnWidth(resolved, key) + delta);
}

/** Removes a stored width, so the column returns to its definition's width. */
export function resetColumnWidth(state: ColumnState, key: string): ColumnState {
  return state.map((entry) => {
    if (entry.key !== key) return entry;
    const { width: _width, ...rest } = entry;
    return rest;
  });
}

/** A column can be hidden while another one stays visible. */
export function canHideColumn<T>(resolved: ResolvedColumns<T>, key: string): boolean {
  const ordered = orderedColumns(resolved);
  return ordered.length > 1 && ordered.some((column) => column.def.key === key);
}

export interface PinOffset {
  /** `start` sticks to the inline start, `end` to the inline end. */
  side: 'start' | 'end';
  /** Distance from that edge, in pixels: the widths of the pins before it. */
  offset: number;
  /** The last start pin or the first end pin (draws the boundary shadow). */
  edge: boolean;
}

/**
 * Sticky offsets of pinned columns. `lead` is the width of anything before
 * the first column (a selection column, for example).
 */
export function pinOffsets<T>(resolved: ResolvedColumns<T>, lead = 0): Map<string, PinOffset> {
  const offsets = new Map<string, PinOffset>();
  let start = Math.max(0, lead);
  resolved.left.forEach((column, index) => {
    offsets.set(column.def.key, {
      side: 'start',
      offset: start,
      edge: index === resolved.left.length - 1,
    });
    start += column.width;
  });
  let end = 0;
  for (let index = resolved.right.length - 1; index >= 0; index--) {
    const column = resolved.right[index] as ResolvedColumn<T>;
    offsets.set(column.def.key, { side: 'end', offset: end, edge: index === 0 });
    end += column.width;
  }
  return offsets;
}

/** Share of the grid's visible width the pinned columns may take and still stick. */
export const PIN_SHARE = 0.5;

/**
 * Whether pinned columns should stick at this visible width. When the pins
 * would cover more than `share` of it (a phone, a narrow panel), they scroll
 * with the rest, so the other columns stay reachable. An unknown width (0)
 * keeps them sticky.
 */
export function pinsFit<T>(
  resolved: ResolvedColumns<T>,
  available: number,
  share = PIN_SHARE
): boolean {
  if (!(available > 0)) return true;
  const pinned = [...resolved.left, ...resolved.right].reduce(
    (sum, column) => sum + column.width,
    0
  );
  return pinned <= available * share;
}

/** Sum of the visible columns' widths. */
export function totalWidth<T>(resolved: ResolvedColumns<T>): number {
  return orderedColumns(resolved).reduce((sum, column) => sum + column.width, 0);
}

export interface HeaderGroupRun {
  /** Stable key for rendering. */
  key: string;
  /** The group, or `null` for columns outside every group. */
  group: ColumnGroupDef | null;
  /** First column of the run, 0-based among the visible columns. */
  start: number;
  span: number;
  zone: PinZone;
  /** Key of the run's first column (for its pin offset). */
  firstKey: string;
}

/**
 * The group header row: consecutive visible columns of the same group, split
 * where a pin zone changes. A group that reordering or pinning split in two
 * shows its header over each part. Unknown keys and repeated memberships are
 * ignored (the first group listing a column wins).
 */
export function headerGroups<T>(
  resolved: ResolvedColumns<T>,
  groups: readonly ColumnGroupDef[]
): HeaderGroupRun[] {
  const owner = new Map<string, ColumnGroupDef>();
  for (const group of groups) {
    for (const key of group.columns) if (!owner.has(key)) owner.set(key, group);
  }
  const runs: HeaderGroupRun[] = [];
  orderedColumns(resolved).forEach((column, index) => {
    const group = owner.get(column.def.key) ?? null;
    const zone = zoneOf(column);
    const last = runs[runs.length - 1];
    if (last && last.group === group && last.zone === zone) {
      last.span += 1;
      return;
    }
    runs.push({
      key: `${group?.id ?? '-'}:${index}`,
      group,
      start: index,
      span: 1,
      zone,
      firstKey: column.def.key,
    });
  });
  return runs;
}

/** Where a pointer at `x` drops among header cells (rects in visual order of the zone). */
export function dropTarget(
  cells: readonly { key: string; left: number; right: number }[],
  x: number,
  rtl = false
): { key: string; side: 'before' | 'after' } | null {
  if (!Number.isFinite(x) || cells.length === 0) return null;
  for (const cell of cells) {
    if (x < cell.left || x > cell.right) continue;
    const firstHalf = x < (cell.left + cell.right) / 2;
    return { key: cell.key, side: firstHalf !== rtl ? 'before' : 'after' };
  }
  // Past either end of the zone: drop at that end.
  const xs = cells.flatMap((cell) => [cell.left, cell.right]);
  const min = Math.min(...xs);
  const leftmost = cells.reduce((a, b) => (b.left < a.left ? b : a));
  const rightmost = cells.reduce((a, b) => (b.right > a.right ? b : a));
  if (x < min) return { key: leftmost.key, side: rtl ? 'after' : 'before' };
  return { key: rightmost.key, side: rtl ? 'before' : 'after' };
}
