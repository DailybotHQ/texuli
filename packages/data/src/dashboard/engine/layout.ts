/**
 * Layout math for dashboards: normalizing untrusted layouts, collision,
 * packing (vertical compaction or none), moves and resizes that push other
 * widgets out of the way, keyboard nudges and first-fit placement.
 *
 * Every operation is pure: it returns a new layout and never mutates its
 * input. Work is bounded by `DASHBOARD_LIMITS.widgets`: placing one widget
 * jumps past at most every other widget once, so a whole pass is at most
 * cubic in the widget count and independent of the numbers in the layout.
 */
import { clampColumns, clampInt, DASHBOARD_LIMITS, isDashboardId } from './limits.ts';
import type {
  DashboardChange,
  DashboardCompaction,
  DashboardGridOptions,
  DashboardIssue,
  DashboardItem,
  DashboardLayout,
} from './types.ts';

/** True when two widgets share at least one cell. */
export function overlaps(a: DashboardItem, b: DashboardItem): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Reading order: row, then column, then id (a total order, so results never depend on input order). */
export function compareItems(a: DashboardItem, b: DashboardItem): number {
  return a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The layout sorted in reading order (a copy). */
export function sortLayout(layout: DashboardLayout): DashboardItem[] {
  return [...layout].sort(compareItems);
}

/** The first row below every widget. */
export function layoutBottom(layout: DashboardLayout): number {
  let bottom = 0;
  for (const item of layout) bottom = Math.max(bottom, item.y + item.h);
  return bottom;
}

function firstCollision(
  item: DashboardItem,
  placed: readonly DashboardItem[]
): DashboardItem | null {
  for (const other of placed) if (other.id !== item.id && overlaps(item, other)) return other;
  return null;
}

/** The lowest bottom edge above `item` among widgets sharing a column with it (0 when none). */
function floorAbove(item: DashboardItem, placed: readonly DashboardItem[]): number {
  let floor = 0;
  for (const other of placed) {
    const bottom = other.y + other.h;
    if (other.x < item.x + item.w && item.x < other.x + other.w && bottom <= item.y) {
      floor = Math.max(floor, bottom);
    }
  }
  return floor;
}

/**
 * The row `item` settles on among `placed`: with `vertical` it first floats
 * up to the widget above it, then (either way) it jumps below whatever it
 * still collides with. Each jump passes one placed widget, so this ends
 * after at most `placed.length` jumps.
 */
function settle(
  item: DashboardItem,
  placed: readonly DashboardItem[],
  compaction: DashboardCompaction
): number {
  let y = compaction === 'vertical' ? floorAbove(item, placed) : item.y;
  for (let jumps = 0; jumps <= placed.length; jumps += 1) {
    const hit = firstCollision({ ...item, y }, placed);
    if (!hit) return y;
    y = hit.y + hit.h;
  }
  return y;
}

/**
 * Removes overlaps and closes gaps: locked widgets stay put, every other
 * widget settles in reading order around them. Deterministic for a set of
 * widgets whatever the input order, so every replica of a synced dashboard
 * that projects the same widgets gets the same layout.
 */
export function compactLayout(
  layout: DashboardLayout,
  compaction: DashboardCompaction = 'vertical'
): DashboardItem[] {
  const sorted = sortLayout(layout);
  const placed: DashboardItem[] = [];
  for (const item of sorted) if (item.locked) placed.push(item);
  const out: DashboardItem[] = [...placed];
  for (const item of sorted) {
    if (item.locked) continue;
    const y = settle(item, placed, compaction);
    const next = y === item.y ? item : { ...item, y };
    placed.push(next);
    out.push(next);
  }
  return out.sort(compareItems);
}

/** The width and height bounds of a widget on a grid of `columns`. */
export function sizeBounds(
  item: Pick<DashboardItem, 'minW' | 'minH' | 'maxW' | 'maxH'>,
  columns: number
): { minW: number; maxW: number; minH: number; maxH: number } {
  const cols = clampColumns(columns);
  const minW = clampInt(item.minW, 1, cols, 1);
  const maxW = clampInt(item.maxW, minW, cols, cols);
  const minH = clampInt(item.minH, 1, DASHBOARD_LIMITS.height, 1);
  const maxH = clampInt(item.maxH, minH, DASHBOARD_LIMITS.height, DASHBOARD_LIMITS.height);
  return { minW, maxW, minH, maxH };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Default width and height for a widget that does not say. */
export function defaultSize(columns: number): { w: number; h: number } {
  return { w: Math.min(clampColumns(columns), 4), h: 3 };
}

/**
 * Reads one untrusted widget: a valid id, whole numbers clamped to the grid
 * (min and max sizes first, then the size, then the position). Returns
 * `null` for an entry that cannot be a widget. `placed` is false when `x`
 * or `y` was missing, so the caller places it with {@link firstFit}.
 */
export function normalizeItem(
  input: unknown,
  columns: number
): { item: DashboardItem; placed: boolean } | null {
  if (!isRecord(input) || !isDashboardId(input.id)) return null;
  const cols = clampColumns(columns);
  const fallback = defaultSize(cols);
  const bounds = sizeBounds(
    {
      minW: input.minW as number | undefined,
      maxW: input.maxW as number | undefined,
      minH: input.minH as number | undefined,
      maxH: input.maxH as number | undefined,
    },
    cols
  );
  const w = clampInt(
    input.w,
    bounds.minW,
    bounds.maxW,
    Math.max(bounds.minW, Math.min(bounds.maxW, fallback.w))
  );
  const h = clampInt(
    input.h,
    bounds.minH,
    bounds.maxH,
    Math.max(bounds.minH, Math.min(bounds.maxH, fallback.h))
  );
  const placed = Number.isFinite(input.x) && Number.isFinite(input.y);
  const item: DashboardItem = {
    id: input.id,
    x: clampInt(input.x, 0, cols - w, 0),
    y: clampInt(input.y, 0, DASHBOARD_LIMITS.rows, 0),
    w,
    h,
    ...(bounds.minW > 1 ? { minW: bounds.minW } : {}),
    ...(bounds.minH > 1 ? { minH: bounds.minH } : {}),
    ...(bounds.maxW < cols && Number.isFinite(input.maxW) ? { maxW: bounds.maxW } : {}),
    ...(bounds.maxH < DASHBOARD_LIMITS.height ? { maxH: bounds.maxH } : {}),
    ...(input.locked === true ? { locked: true } : {}),
  };
  return { item, placed };
}

/**
 * The first free slot for a `w` by `h` widget, scanning rows from the top
 * and columns from the inline start. Candidates are only the grid origin
 * and the edges of existing widgets, so the scan is bounded by the widget
 * count, not the grid size.
 */
export function firstFit(
  layout: DashboardLayout,
  size: { w: number; h: number },
  columns: number
): { x: number; y: number } {
  const cols = clampColumns(columns);
  const w = Math.min(cols, Math.max(1, Math.round(size.w)));
  const h = Math.max(1, Math.round(size.h));
  const ys = new Set<number>([0]);
  const xs = new Set<number>([0]);
  for (const item of layout) {
    ys.add(item.y + item.h);
    if (item.x + item.w + w <= cols) xs.add(item.x + item.w);
  }
  const rows = [...ys].sort((a, b) => a - b);
  const starts = [...xs].sort((a, b) => a - b);
  for (const y of rows) {
    for (const x of starts) {
      if (!firstCollision({ id: '', x, y, w, h }, layout)) return { x, y };
    }
  }
  return { x: 0, y: layoutBottom(layout) };
}

/**
 * Reads an untrusted layout (storage, a sync peer, an agent): drops entries
 * that are not widgets and duplicate ids, caps the count, clamps every
 * number to the grid, places widgets without a position first-fit, and
 * resolves overlaps. Returns a layout that every other operation accepts.
 */
export function normalizeLayout(
  input: unknown,
  options: DashboardGridOptions
): { layout: DashboardItem[]; issues: DashboardIssue[] } {
  const issues: DashboardIssue[] = [];
  if (!Array.isArray(input)) {
    if (input !== undefined) issues.push({ path: '', message: 'A layout is an array of widgets.' });
    return { layout: [], issues };
  }
  const cols = clampColumns(options.columns);
  const seen = new Set<string>();
  const placed: DashboardItem[] = [];
  const unplaced: DashboardItem[] = [];
  const count = Math.min(input.length, DASHBOARD_LIMITS.widgets);
  if (input.length > count) {
    issues.push({
      path: '',
      message: `At most ${DASHBOARD_LIMITS.widgets} widgets; the rest were dropped.`,
    });
  }
  for (let i = 0; i < count; i += 1) {
    const read = normalizeItem(input[i], cols);
    if (!read) {
      issues.push({ path: `[${i}]`, message: 'Not a widget: it needs a valid id.' });
      continue;
    }
    if (seen.has(read.item.id)) {
      issues.push({ path: `[${i}].id`, message: `Duplicate widget id "${read.item.id}".` });
      continue;
    }
    seen.add(read.item.id);
    (read.placed ? placed : unplaced).push(read.item);
  }
  // Locked widgets keep their place unless they overlap an earlier locked one.
  const locked: DashboardItem[] = [];
  const rest: DashboardItem[] = [];
  for (const item of sortLayout(placed)) {
    if (item.locked && !firstCollision(item, locked)) locked.push(item);
    else rest.push(item.locked ? { ...item, locked: undefined } : item);
  }
  let layout = compactLayout([...locked, ...rest].map(strip), options.compaction ?? 'vertical');
  for (const item of unplaced) {
    const at = firstFit(layout, item, cols);
    layout = [...layout, { ...item, ...at }];
  }
  return { layout: compactLayout(layout, options.compaction ?? 'vertical'), issues };
}

/** Drops `undefined` members so layouts compare and serialize cleanly. */
function strip(item: DashboardItem): DashboardItem {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) if (value !== undefined) out[key] = value;
  return out as unknown as DashboardItem;
}

/**
 * Puts `target` (a moved or resized copy of a widget) on the grid and lets
 * every other unlocked widget settle around it. A widget the target lands
 * on while moving down swaps above it when it fits there, so a widget can
 * pass its neighbour one step at a time.
 */
function placeAround(
  layout: DashboardLayout,
  original: DashboardItem,
  target: DashboardItem,
  compaction: DashboardCompaction
): DashboardItem[] {
  const placed: DashboardItem[] = [];
  for (const item of layout) if (item.locked) placed.push(item);
  placed.push(target);
  const out: DashboardItem[] = [...placed];
  const movingDown = target.y > original.y;
  for (const item of sortLayout(layout)) {
    if (item.locked || item.id === target.id) continue;
    let next: DashboardItem | null = null;
    if (movingDown && overlaps(item, target)) {
      const above = { ...item, y: Math.max(0, target.y - item.h) };
      if (above.y < item.y && !firstCollision(above, placed)) next = above;
    }
    if (!next) {
      const y = settle(item, placed, compaction);
      next = y === item.y ? item : { ...item, y };
    }
    placed.push(next);
    out.push(next);
  }
  return compaction === 'vertical' ? compactLayout(out, 'vertical') : out.sort(compareItems);
}

function find(layout: DashboardLayout, id: string): DashboardItem | undefined {
  return layout.find((item) => item.id === id);
}

function touchesLocked(layout: DashboardLayout, item: DashboardItem): boolean {
  return layout.some((other) => other.locked && other.id !== item.id && overlaps(item, other));
}

/**
 * Moves a widget to a cell (clamped to the grid). Widgets it lands on are
 * pushed down (or swap above it), then the layout compacts. Refused for an
 * unknown or locked widget, or a cell that overlaps a locked widget.
 */
export function moveItem(
  layout: DashboardLayout,
  id: string,
  to: { x: number; y: number },
  options: DashboardGridOptions
): DashboardChange {
  const item = find(layout, id);
  if (!item) return { ok: false, reason: 'unknown-item' };
  if (item.locked) return { ok: false, reason: 'locked' };
  const cols = clampColumns(options.columns);
  const target: DashboardItem = {
    ...item,
    x: clampInt(to.x, 0, Math.max(0, cols - item.w), item.x),
    y: clampInt(to.y, 0, DASHBOARD_LIMITS.rows, item.y),
  };
  if (touchesLocked(layout, target)) return { ok: false, reason: 'locked' };
  const next = placeAround(layout, item, target, options.compaction ?? 'vertical');
  return { ok: true, layout: next, item: find(next, id) ?? target };
}

/**
 * Resizes a widget (clamped to its bounds and to the columns after its
 * start). Widgets it grows over are pushed down, then the layout compacts.
 * Refused for an unknown or locked widget, a size that cannot change
 * (`size`), or one that would cover a locked widget.
 */
export function resizeItem(
  layout: DashboardLayout,
  id: string,
  size: { w: number; h: number },
  options: DashboardGridOptions
): DashboardChange {
  const item = find(layout, id);
  if (!item) return { ok: false, reason: 'unknown-item' };
  if (item.locked) return { ok: false, reason: 'locked' };
  const cols = clampColumns(options.columns);
  const bounds = sizeBounds(item, cols);
  const w = clampInt(size.w, bounds.minW, Math.min(bounds.maxW, cols - item.x), item.w);
  const h = clampInt(size.h, bounds.minH, bounds.maxH, item.h);
  if (w === item.w && h === item.h) {
    const asked = Math.round(size.w) !== item.w || Math.round(size.h) !== item.h;
    return asked ? { ok: false, reason: 'size' } : { ok: true, layout, item };
  }
  const target: DashboardItem = { ...item, w, h };
  if (touchesLocked(layout, target)) return { ok: false, reason: 'locked' };
  const next = placeAround(layout, item, target, options.compaction ?? 'vertical');
  return { ok: true, layout: next, item: find(next, id) ?? target };
}

/**
 * One keyboard step: moves a widget by `dx` columns and `dy` rows. With
 * vertical compaction a one-row step down can fall straight back, so the
 * step grows (up to the tallest widget plus one row) until the widget
 * really moves; it is refused with `edge` when it never does.
 */
export function nudgeItem(
  layout: DashboardLayout,
  id: string,
  delta: { dx: number; dy: number },
  options: DashboardGridOptions
): DashboardChange {
  const item = find(layout, id);
  if (!item) return { ok: false, reason: 'unknown-item' };
  if (item.locked) return { ok: false, reason: 'locked' };
  const dx = Math.sign(delta.dx);
  const dy = Math.sign(delta.dy);
  if (dx === 0 && dy === 0) return { ok: false, reason: 'edge' };
  let tallest = 1;
  for (const other of layout) tallest = Math.max(tallest, other.h);
  const steps = dy === 0 ? 1 : tallest + 1;
  let refusal: DashboardChange | null = null;
  for (let step = 1; step <= steps; step += 1) {
    const result = moveItem(layout, id, { x: item.x + dx * step, y: item.y + dy * step }, options);
    if (!result.ok) {
      refusal ??= result;
      continue;
    }
    if (result.item.x !== item.x || result.item.y !== item.y) return result;
  }
  return refusal ?? { ok: false, reason: 'edge' };
}

/** Adds a widget at its own position, or first-fit when it has none, then compacts. */
export function addItem(
  layout: DashboardLayout,
  input: Partial<DashboardItem> & { id: string },
  options: DashboardGridOptions
): DashboardChange {
  const read = normalizeItem(input, options.columns);
  if (!read) return { ok: false, reason: 'unknown-item' };
  if (find(layout, read.item.id) || layout.length >= DASHBOARD_LIMITS.widgets) {
    return { ok: false, reason: 'size' };
  }
  const item = read.placed
    ? read.item
    : { ...read.item, ...firstFit(layout, read.item, options.columns) };
  const next = read.placed
    ? placeAround([...layout, item], item, item, options.compaction ?? 'vertical')
    : compactLayout([...layout, item], options.compaction ?? 'vertical');
  return { ok: true, layout: next, item: find(next, item.id) ?? item };
}

/** Removes a widget (refused when locked), then compacts. */
export function removeItem(
  layout: DashboardLayout,
  id: string,
  options: Pick<DashboardGridOptions, 'compaction'> = {}
): DashboardChange {
  const item = find(layout, id);
  if (!item) return { ok: false, reason: 'unknown-item' };
  if (item.locked) return { ok: false, reason: 'locked' };
  return {
    ok: true,
    layout: compactLayout(
      layout.filter((other) => other.id !== id),
      options.compaction ?? 'vertical'
    ),
    item,
  };
}

/** True when two layouts place the same widgets at the same cells and sizes. */
export function sameLayout(a: DashboardLayout, b: DashboardLayout): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((item) => [item.id, item]));
  for (const item of a) {
    const other = byId.get(item.id);
    if (
      !other ||
      other.x !== item.x ||
      other.y !== item.y ||
      other.w !== item.w ||
      other.h !== item.h
    ) {
      return false;
    }
  }
  return true;
}
