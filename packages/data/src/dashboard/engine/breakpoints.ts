/**
 * Responsive breakpoints: which grid a container width gets, and how a
 * layout written for one column count reflows onto another.
 */
import { compactLayout, compareItems, normalizeLayout, sizeBounds } from './layout.ts';
import { clampColumns, clampInt, DASHBOARD_LIMITS, isDashboardId } from './limits.ts';
import type {
  DashboardBreakpoint,
  DashboardCompaction,
  DashboardItem,
  DashboardLayout,
} from './types.ts';

/**
 * Breakpoints for a dashboard designed on `columns`: the full grid from
 * 1,024 px, at most 6 columns from 640 px, and one stacked column below.
 */
export function dashboardBreakpoints(columns = 12): DashboardBreakpoint[] {
  const cols = clampColumns(columns);
  const out: DashboardBreakpoint[] = [{ id: 'lg', minWidth: 1024, columns: cols }];
  if (cols > 6) out.push({ id: 'md', minWidth: 640, columns: 6 });
  else if (cols > 1) out.push({ id: 'md', minWidth: 640, columns: cols });
  out.push({ id: 'sm', minWidth: 0, columns: 1 });
  return out;
}

/** The default breakpoints (`dashboardBreakpoints(12)`). */
export const DEFAULT_DASHBOARD_BREAKPOINTS: readonly DashboardBreakpoint[] = Object.freeze(
  dashboardBreakpoints(12).map((breakpoint) => Object.freeze(breakpoint))
);

/**
 * Reads untrusted breakpoints: valid unique ids, whole widths and column
 * counts, at most `DASHBOARD_LIMITS.breakpoints`, widest first. The
 * narrowest always starts at 0 px so every width has a grid.
 */
export function normalizeBreakpoints(input: unknown): DashboardBreakpoint[] {
  if (!Array.isArray(input)) return [...DEFAULT_DASHBOARD_BREAKPOINTS];
  const seen = new Set<string>();
  const out: DashboardBreakpoint[] = [];
  for (const entry of input.slice(0, DASHBOARD_LIMITS.breakpoints)) {
    if (entry === null || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (!isDashboardId(record.id) || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push({
      id: record.id,
      minWidth: clampInt(record.minWidth, 0, 100_000, 0),
      columns: clampColumns(record.columns),
    });
  }
  if (out.length === 0) return [...DEFAULT_DASHBOARD_BREAKPOINTS];
  out.sort((a, b) => b.minWidth - a.minWidth || (a.id < b.id ? -1 : 1));
  const last = out[out.length - 1] as DashboardBreakpoint;
  if (last.minWidth !== 0) out[out.length - 1] = { ...last, minWidth: 0 };
  return out;
}

/** The breakpoint for a container width (widest first; the last one catches the rest). */
export function resolveBreakpoint(
  width: number,
  breakpoints: readonly DashboardBreakpoint[]
): DashboardBreakpoint {
  const list = breakpoints.length > 0 ? breakpoints : DEFAULT_DASHBOARD_BREAKPOINTS;
  const w = Number.isFinite(width) ? width : 0;
  for (const breakpoint of list) if (w >= breakpoint.minWidth) return breakpoint;
  return list[list.length - 1] as DashboardBreakpoint;
}

/**
 * Reflows a layout from `from` columns onto `to` columns: positions and
 * widths scale by `to / from` (kept within each widget's bounds and the
 * grid), then widgets settle in their original reading order, so a narrow
 * grid reads like the wide one. One column stacks every widget. A locked
 * widget stays locked unless it would overlap an earlier locked one.
 */
export function reflowLayout(
  layout: DashboardLayout,
  from: number,
  to: number,
  compaction: DashboardCompaction = 'vertical'
): DashboardItem[] {
  const source = clampColumns(from);
  const target = clampColumns(to);
  const ordered = [...layout].sort(compareItems);
  if (source === target) return compactLayout(ordered, compaction);
  const ratio = target / source;
  // Reading order survives the reflow: each widget starts on its own row
  // index, so packing keeps the sequence the wide grid had.
  const scaled = ordered.map((item, index): DashboardItem => {
    const bounds = sizeBounds(item, target);
    const w = Math.min(
      target,
      Math.max(bounds.minW, Math.min(bounds.maxW, Math.round(item.w * ratio) || 1))
    );
    const x = Math.min(target - w, Math.max(0, Math.round(item.x * ratio)));
    return { ...item, x, y: target === 1 ? index : item.y, w };
  });
  // Normalizing again keeps locks apart: two locked widgets that now overlap
  // leave the later one unlocked rather than stacked.
  return normalizeLayout(scaled, { columns: target, compaction }).layout;
}

/**
 * The layout for one breakpoint: its own saved layout when there is one,
 * otherwise the nearest wider breakpoint's (or, failing that, the nearest
 * narrower one's) reflowed onto its columns. `layouts` is untrusted and is
 * normalized on the way.
 */
export function layoutForBreakpoint(
  layouts: Readonly<Record<string, unknown>>,
  breakpoint: DashboardBreakpoint,
  breakpoints: readonly DashboardBreakpoint[],
  compaction: DashboardCompaction = 'vertical'
): DashboardItem[] {
  const own = Object.hasOwn(layouts, breakpoint.id) ? layouts[breakpoint.id] : undefined;
  if (Array.isArray(own)) {
    return normalizeLayout(own, { columns: breakpoint.columns, compaction }).layout;
  }
  const index = breakpoints.findIndex((entry) => entry.id === breakpoint.id);
  const order = [
    ...breakpoints.slice(0, Math.max(0, index)).reverse(),
    ...breakpoints.slice(index + 1),
  ];
  for (const source of order) {
    const saved = Object.hasOwn(layouts, source.id) ? layouts[source.id] : undefined;
    if (!Array.isArray(saved)) continue;
    const read = normalizeLayout(saved, { columns: source.columns, compaction }).layout;
    return reflowLayout(read, source.columns, breakpoint.columns, compaction);
  }
  return [];
}
