/**
 * Persistence: a dashboard's layouts as one versioned JSON document the
 * host stores wherever it likes (Texuli ships no storage engine), read back
 * as untrusted input. `diffLayout` lists per-widget changes, the shape a
 * sync binding writes as one last-writer-wins register per widget
 * (ADR-010: a sequence of widgets with register layouts).
 */
import { normalizeBreakpoints } from './breakpoints.ts';
import { normalizeLayout, sortLayout } from './layout.ts';
import { DASHBOARD_LIMITS, isDashboardId } from './limits.ts';
import type {
  DashboardBreakpoint,
  DashboardCompaction,
  DashboardIssue,
  DashboardItem,
  DashboardLayout,
  DashboardState,
} from './types.ts';

const ITEM_KEYS = ['id', 'x', 'y', 'w', 'h', 'minW', 'minH', 'maxW', 'maxH', 'locked'] as const;

function plainItem(item: DashboardItem): DashboardItem {
  const out: Record<string, unknown> = {};
  for (const key of ITEM_KEYS) if (item[key] !== undefined) out[key] = item[key];
  return out as unknown as DashboardItem;
}

/** A dashboard state from layouts keyed by breakpoint id. */
export function dashboardState(layouts: Readonly<Record<string, DashboardLayout>>): DashboardState {
  const out: Record<string, DashboardLayout> = {};
  for (const id of Object.keys(layouts).sort()) {
    const layout = layouts[id];
    if (isDashboardId(id) && layout) out[id] = sortLayout(layout).map(plainItem);
  }
  return { format: 'texuli-dashboard', formatVersion: 1, layouts: out };
}

/** Canonical JSON for a dashboard's layouts (sorted breakpoints, widgets in reading order). */
export function serializeDashboard(layouts: Readonly<Record<string, DashboardLayout>>): string {
  return JSON.stringify(dashboardState(layouts));
}

export interface ParseDashboardOptions {
  /** The dashboard's breakpoints, so each layout is clamped to its own columns. */
  readonly breakpoints?: readonly DashboardBreakpoint[];
  readonly compaction?: DashboardCompaction;
}

export interface ParsedDashboard {
  /** The state, or `null` when the input is not a dashboard at all. */
  readonly state: DashboardState | null;
  /** What was refused, dropped or clamped on the way. */
  readonly issues: readonly DashboardIssue[];
}

/**
 * Reads a stored dashboard (a JSON string or a parsed value) as untrusted
 * input: at most `DASHBOARD_LIMITS.stateBytes` of text, the
 * `texuli-dashboard` format at version 1, breakpoint ids only, and each
 * layout normalized on its breakpoint's columns. Never throws.
 */
export function parseDashboard(
  input: unknown,
  options: ParseDashboardOptions = {}
): ParsedDashboard {
  const issues: DashboardIssue[] = [];
  let value = input;
  if (typeof input === 'string') {
    if (input.length > DASHBOARD_LIMITS.stateBytes) {
      return { state: null, issues: [{ path: '', message: 'The saved dashboard is too large.' }] };
    }
    try {
      value = JSON.parse(input);
    } catch {
      return { state: null, issues: [{ path: '', message: 'The saved dashboard is not JSON.' }] };
    }
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { state: null, issues: [{ path: '', message: 'A saved dashboard is an object.' }] };
  }
  const record = value as Record<string, unknown>;
  if (record.format !== 'texuli-dashboard' || record.formatVersion !== 1) {
    return {
      state: null,
      issues: [{ path: 'format', message: 'Not a texuli-dashboard document at version 1.' }],
    };
  }
  const raw = record.layouts;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { state: null, issues: [{ path: 'layouts', message: 'layouts is an object.' }] };
  }
  const breakpoints = options.breakpoints ? normalizeBreakpoints(options.breakpoints) : null;
  const layouts: Record<string, DashboardLayout> = {};
  let count = 0;
  for (const id of Object.keys(raw)) {
    if (!isDashboardId(id)) {
      issues.push({ path: 'layouts', message: 'A breakpoint id was not valid; it was dropped.' });
      continue;
    }
    const breakpoint = breakpoints?.find((entry) => entry.id === id);
    if (breakpoints && !breakpoint) {
      issues.push({ path: `layouts.${id}`, message: `No breakpoint "${id}"; it was dropped.` });
      continue;
    }
    if (count >= DASHBOARD_LIMITS.breakpoints) {
      issues.push({ path: `layouts.${id}`, message: 'Too many layouts; the rest were dropped.' });
      break;
    }
    count += 1;
    const read = normalizeLayout((raw as Record<string, unknown>)[id], {
      columns: breakpoint?.columns ?? DASHBOARD_LIMITS.columns,
      compaction: options.compaction ?? 'vertical',
    });
    for (const issue of read.issues) {
      issues.push({ path: `layouts.${id}${issue.path}`, message: issue.message });
    }
    layouts[id] = read.layout;
  }
  return { state: dashboardState(layouts), issues };
}

/** One widget's change between two layouts. */
export type DashboardLayoutDiff =
  | { readonly type: 'place'; readonly item: DashboardItem }
  | { readonly type: 'remove'; readonly id: string };

/**
 * The widgets that were added, moved, resized or changed, and the ones
 * removed, from `before` to `after`, sorted by id. A sync binding writes
 * each `place` as that widget's register and each `remove` as a delete.
 */
export function diffLayout(before: DashboardLayout, after: DashboardLayout): DashboardLayoutDiff[] {
  const out: DashboardLayoutDiff[] = [];
  const old = new Map(before.map((item) => [item.id, item]));
  const ids = new Set<string>();
  for (const item of after) {
    ids.add(item.id);
    const prev = old.get(item.id);
    if (!prev || ITEM_KEYS.some((key) => prev[key] !== item[key])) {
      out.push({ type: 'place', item: plainItem(item) });
    }
  }
  for (const item of before) if (!ids.has(item.id)) out.push({ type: 'remove', id: item.id });
  return out.sort((a, b) => {
    const ka = a.type === 'place' ? a.item.id : a.id;
    const kb = b.type === 'place' ? b.item.id : b.id;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
