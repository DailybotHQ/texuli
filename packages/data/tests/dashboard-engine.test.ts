// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addItem,
  cellFromDelta,
  compactLayout,
  DASHBOARD_LIMITS,
  type DashboardItem,
  type DashboardLayout,
  dashboardBreakpoints,
  dashboardKeyIntent,
  diffLayout,
  firstFit,
  formatDashboardMessage,
  formatDashboardRefusal,
  layoutForBreakpoint,
  moveItem,
  normalizeBreakpoints,
  normalizeLayout,
  nudgeItem,
  overlaps,
  parseDashboard,
  positionValues,
  reflowLayout,
  removeItem,
  resizeItem,
  resolveBreakpoint,
  resolveDashboardMessages,
  serializeDashboard,
} from '../src/dashboard/engine/index.ts';

// The dashboard engine (PLAN_010 T-dashboard): framework-free layout math
// with hostile-input bounds. Every result must be a valid layout: inside the
// grid, no two widgets sharing a cell.

const grid = { columns: 12 } as const;

function assertValid(layout: DashboardLayout, columns: number): void {
  const ids = new Set<string>();
  for (const item of layout) {
    expect(ids.has(item.id), `duplicate ${item.id}`).toBe(false);
    ids.add(item.id);
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      expect(Number.isInteger(item[key]), `${item.id}.${key}`).toBe(true);
    }
    expect(item.x).toBeGreaterThanOrEqual(0);
    expect(item.y).toBeGreaterThanOrEqual(0);
    expect(item.w).toBeGreaterThanOrEqual(1);
    expect(item.h).toBeGreaterThanOrEqual(1);
    expect(item.x + item.w, `${item.id} inside the grid`).toBeLessThanOrEqual(columns);
  }
  for (let i = 0; i < layout.length; i += 1) {
    for (let j = i + 1; j < layout.length; j += 1) {
      const a = layout[i] as DashboardItem;
      const b = layout[j] as DashboardItem;
      expect(overlaps(a, b), `${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
}

const at = (layout: DashboardLayout, id: string) => layout.find((item) => item.id === id);
const place = (layout: DashboardLayout) =>
  Object.fromEntries(layout.map((item) => [item.id, [item.x, item.y, item.w, item.h]]));

/** Two rows: a and b side by side, c under a. */
const base: DashboardItem[] = [
  { id: 'a', x: 0, y: 0, w: 6, h: 2 },
  { id: 'b', x: 6, y: 0, w: 6, h: 2 },
  { id: 'c', x: 0, y: 2, w: 6, h: 2 },
];

describe('normalizeLayout', () => {
  it('clamps, dedupes, drops junk and resolves overlaps from hostile input', () => {
    const hostile: unknown[] = [
      { id: 'a', x: -5, y: Number.NaN, w: 99, h: 1e9 },
      { id: 'a', x: 0, y: 0, w: 1, h: 1 },
      { id: '__proto__', x: 0, y: 0, w: 1, h: 1 },
      { id: 'b c', x: 0, y: 0, w: 1, h: 1 },
      null,
      'widget',
      [1, 2],
      { id: 'b', x: Number.POSITIVE_INFINITY, y: 1e12, w: -3, h: '4' },
      { id: 'c', x: 3, y: 0, w: 4, h: 2 },
      { id: 'd', x: 3, y: 0, w: 4, h: 2 },
      { id: 'x'.repeat(65), x: 0, y: 0, w: 1, h: 1 },
    ];
    const { layout, issues } = normalizeLayout(hostile, grid);
    assertValid(layout, 12);
    expect(layout.map((item) => item.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(at(layout, 'a')?.w).toBe(12);
    expect(at(layout, 'a')?.h).toBe(DASHBOARD_LIMITS.height);
    expect(issues.length).toBeGreaterThanOrEqual(6);
    expect(normalizeLayout('nope', grid).layout).toEqual([]);
  });

  it('gives the same layout whatever order the widgets arrive in (sync replicas agree)', () => {
    const input = [
      { id: 'k1', x: 0, y: 3, w: 4, h: 2 },
      { id: 'k2', x: 2, y: 3, w: 4, h: 3 },
      { id: 'k3', x: 0, y: 0, w: 12, h: 1 },
      { id: 'k4', x: 8, y: 9, w: 4, h: 4, locked: true },
      { id: 'k5', x: 8, y: 9, w: 2, h: 1 },
    ];
    const first = normalizeLayout(input, grid).layout;
    for (let seed = 1; seed < 20; seed += 1) {
      const shuffled = [...input].sort(
        (a, b) => ((a.id.charCodeAt(1) * seed) % 7) - ((b.id.charCodeAt(1) * seed) % 7)
      );
      expect(normalizeLayout(shuffled, grid).layout).toEqual(first);
    }
    assertValid(first, 12);
  });

  it('places widgets without a position first-fit and caps the widget count', () => {
    const { layout } = normalizeLayout(
      [
        { id: 'top', x: 0, y: 0, w: 8, h: 2 },
        { id: 'auto', w: 4, h: 2 },
      ],
      grid
    );
    expect(at(layout, 'auto')).toMatchObject({ x: 8, y: 0 });
    const many = Array.from({ length: 300 }, (_, i) => ({ id: `w${i}`, x: 0, y: 0, w: 1, h: 1 }));
    const capped = normalizeLayout(many, grid);
    expect(capped.layout).toHaveLength(DASHBOARD_LIMITS.widgets);
    expect(capped.issues.some((issue) => issue.message.includes('At most'))).toBe(true);
  });

  it('stays fast on the worst case: every widget stacked on one cell, and huge inputs', () => {
    const stacked = Array.from({ length: 10_000 }, (_, i) => ({
      id: `s${i}`,
      x: 0,
      y: 0,
      w: (i % 12) + 1,
      h: (i % 5) + 1,
    }));
    const started = performance.now();
    const { layout } = normalizeLayout(stacked, grid);
    const result = nudgeItem(layout, 's5', { dx: 0, dy: 1 }, grid);
    const elapsed = performance.now() - started;
    assertValid(layout, 12);
    expect(result.ok).toBe(true);
    // Linear in the input past the 200-widget cap; cubic in at most 200 widgets.
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('compactLayout', () => {
  it('floats widgets up with vertical compaction and keeps gaps with none', () => {
    const gappy = [
      { id: 'a', x: 0, y: 4, w: 6, h: 2 },
      { id: 'b', x: 0, y: 9, w: 6, h: 2 },
    ];
    expect(place(compactLayout(gappy, 'vertical'))).toEqual({ a: [0, 0, 6, 2], b: [0, 2, 6, 2] });
    expect(place(compactLayout(gappy, 'none'))).toEqual({ a: [0, 4, 6, 2], b: [0, 9, 6, 2] });
  });

  it('never moves a locked widget and flows the others around it', () => {
    const layout = compactLayout([
      { id: 'pin', x: 0, y: 2, w: 12, h: 1, locked: true },
      { id: 'a', x: 0, y: 1, w: 4, h: 2 },
    ]);
    expect(at(layout, 'pin')).toMatchObject({ x: 0, y: 2 });
    expect(at(layout, 'a')?.y).toBe(0);
    assertValid(layout, 12);
  });
});

describe('moveItem and nudgeItem', () => {
  it('pushes the widgets it lands on and compacts', () => {
    const result = moveItem(base, 'c', { x: 6, y: 0 }, grid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    assertValid(result.layout, 12);
    expect(at(result.layout, 'c')).toMatchObject({ x: 6, y: 0 });
    expect(at(result.layout, 'b')).toMatchObject({ x: 6, y: 2 });
  });

  it('clamps the target cell to the grid', () => {
    const result = moveItem(base, 'a', { x: 40, y: -9 }, grid);
    expect(result.ok && at(result.layout, 'a')).toMatchObject({ x: 6, y: 0 });
  });

  it('refuses locked widgets, cells over locked widgets and unknown ids', () => {
    const locked = base.map((item) => (item.id === 'b' ? { ...item, locked: true } : item));
    expect(moveItem(locked, 'b', { x: 0, y: 0 }, grid)).toEqual({ ok: false, reason: 'locked' });
    expect(moveItem(locked, 'a', { x: 6, y: 0 }, grid)).toEqual({ ok: false, reason: 'locked' });
    expect(moveItem(locked, 'zz', { x: 0, y: 0 }, grid)).toEqual({
      ok: false,
      reason: 'unknown-item',
    });
  });

  it('steps one column or row per key, passing the widget below, and stops at the edges', () => {
    const down = nudgeItem(base, 'a', { dx: 0, dy: 1 }, grid);
    expect(down.ok && place(down.layout)).toEqual({
      c: [0, 0, 6, 2],
      a: [0, 2, 6, 2],
      b: [6, 0, 6, 2],
    });
    const right = nudgeItem(base, 'c', { dx: 1, dy: 0 }, grid);
    expect(right.ok && right.item).toMatchObject({ x: 1 });
    expect(nudgeItem(base, 'a', { dx: 0, dy: -1 }, grid)).toEqual({ ok: false, reason: 'edge' });
    expect(nudgeItem(base, 'b', { dx: 1, dy: 0 }, grid)).toEqual({ ok: false, reason: 'edge' });
    // Nothing below: vertical compaction would pull it straight back.
    expect(nudgeItem(base, 'b', { dx: 0, dy: 1 }, grid)).toEqual({ ok: false, reason: 'edge' });
    // With no compaction the widget leaves a gap above it.
    const free = nudgeItem(base, 'b', { dx: 0, dy: 1 }, { columns: 12, compaction: 'none' });
    expect(free.ok && free.item).toMatchObject({ y: 1 });
  });
});

describe('resizeItem', () => {
  it('grows over neighbours by pushing them down', () => {
    const result = resizeItem(base, 'a', { w: 6, h: 4 }, grid);
    expect(result.ok && place(result.layout)).toEqual({
      a: [0, 0, 6, 4],
      b: [6, 0, 6, 2],
      c: [0, 4, 6, 2],
    });
    const wider = resizeItem(base, 'c', { w: 12, h: 2 }, grid);
    expect(wider.ok).toBe(true);
    if (wider.ok) assertValid(wider.layout, 12);
  });

  it('keeps sizes inside min, max and the grid, and refuses a size that cannot change', () => {
    const bounded = base.map((item) =>
      item.id === 'a' ? { ...item, minW: 2, maxW: 6, maxH: 3 } : item
    );
    expect(resizeItem(bounded, 'a', { w: 7, h: 2 }, grid)).toEqual({ ok: false, reason: 'size' });
    const tall = resizeItem(bounded, 'a', { w: 6, h: 9 }, grid);
    expect(tall.ok && tall.item).toMatchObject({ h: 3 });
    expect(resizeItem(bounded, 'b', { w: 7, h: 2 }, grid)).toEqual({ ok: false, reason: 'size' });
    const locked = base.map((item) => (item.id === 'c' ? { ...item, locked: true } : item));
    expect(resizeItem(locked, 'a', { w: 6, h: 3 }, grid)).toEqual({ ok: false, reason: 'locked' });
  });
});

describe('add, remove and first fit', () => {
  it('fits a new widget into the first hole and removes widgets with compaction', () => {
    expect(firstFit(base, { w: 6, h: 2 }, 12)).toEqual({ x: 6, y: 2 });
    const added = addItem(base, { id: 'd', w: 6, h: 2 }, grid);
    expect(added.ok && added.item).toMatchObject({ x: 6, y: 2 });
    expect(addItem(base, { id: 'a' }, grid)).toEqual({ ok: false, reason: 'size' });
    const removed = removeItem(base, 'a');
    expect(removed.ok && at(removed.layout, 'c')).toMatchObject({ y: 0 });
  });
});

describe('breakpoints', () => {
  it('resolves a width to its grid and normalizes hostile breakpoints', () => {
    const list = dashboardBreakpoints(12);
    expect(list.map((entry) => [entry.id, entry.minWidth, entry.columns])).toEqual([
      ['lg', 1024, 12],
      ['md', 640, 6],
      ['sm', 0, 1],
    ]);
    expect(resolveBreakpoint(1200, list).id).toBe('lg');
    expect(resolveBreakpoint(700, list).id).toBe('md');
    expect(resolveBreakpoint(Number.NaN, list).id).toBe('sm');
    const read = normalizeBreakpoints([
      { id: 'wide', minWidth: 900, columns: 99 },
      { id: 'wide', minWidth: 1, columns: 1 },
      { id: 'narrow', minWidth: 300, columns: 2 },
      { id: '<x>', minWidth: 0, columns: 1 },
    ]);
    expect(read).toEqual([
      { id: 'wide', minWidth: 900, columns: 24 },
      { id: 'narrow', minWidth: 0, columns: 2 },
    ]);
  });

  it('reflows a wide layout onto fewer columns in reading order', () => {
    const one = reflowLayout(base, 12, 1);
    expect(one.map((item) => [item.id, item.x, item.y, item.w])).toEqual([
      ['a', 0, 0, 1],
      ['b', 0, 2, 1],
      ['c', 0, 4, 1],
    ]);
    const six = reflowLayout(base, 12, 6);
    assertValid(six, 6);
    expect(place(six)).toEqual({ a: [0, 0, 3, 2], b: [3, 0, 3, 2], c: [0, 2, 3, 2] });
  });

  it('uses a breakpoint’s own layout, else reflows the nearest wider one', () => {
    const list = dashboardBreakpoints(12);
    const md = list[1] as (typeof list)[number];
    expect(layoutForBreakpoint({ lg: base }, md, list)).toEqual(reflowLayout(base, 12, 6));
    const own = [{ id: 'a', x: 0, y: 0, w: 6, h: 1 }];
    expect(layoutForBreakpoint({ lg: base, md: own }, md, list)).toEqual(own);
    expect(layoutForBreakpoint({}, md, list)).toEqual([]);
  });
});

describe('persistence', () => {
  it('round-trips through canonical JSON', () => {
    const json = serializeDashboard({ lg: base, sm: reflowLayout(base, 12, 1) });
    const parsed = parseDashboard(json, { breakpoints: dashboardBreakpoints(12) });
    expect(parsed.issues).toEqual([]);
    expect(parsed.state?.layouts.lg).toEqual(base);
    expect(serializeDashboard(parsed.state?.layouts ?? {})).toBe(json);
  });

  it('reads stored state as untrusted input and never throws', () => {
    const cases: unknown[] = [
      'x'.repeat(DASHBOARD_LIMITS.stateBytes + 1),
      '{not json',
      '[]',
      { format: 'other', formatVersion: 1, layouts: {} },
      { format: 'texuli-dashboard', formatVersion: 2, layouts: {} },
      { format: 'texuli-dashboard', formatVersion: 1, layouts: [] },
    ];
    for (const input of cases) expect(parseDashboard(input).state).toBeNull();
    const parsed = parseDashboard(
      JSON.parse(
        '{"format":"texuli-dashboard","formatVersion":1,"layouts":{"__proto__":[],"lg":[{"id":"a","x":0,"y":0,"w":400,"h":1}],"zz":[]}}'
      ),
      { breakpoints: dashboardBreakpoints(12) }
    );
    expect(Object.keys(parsed.state?.layouts ?? {})).toEqual(['lg']);
    expect(parsed.state?.layouts.lg?.[0]?.w).toBe(12);
    expect(parsed.issues.length).toBe(2);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('diffs two layouts into per-widget registers for a sync binding', () => {
    const moved = moveItem(base, 'c', { x: 6, y: 0 }, grid);
    if (!moved.ok) throw new Error('move refused');
    const after = moved.layout.filter((item) => item.id !== 'a');
    expect(diffLayout(base, after)).toEqual([
      { type: 'remove', id: 'a' },
      { type: 'place', item: { id: 'b', x: 6, y: 2, w: 6, h: 2 } },
      { type: 'place', item: { id: 'c', x: 6, y: 0, w: 6, h: 2 } },
    ]);
  });
});

describe('keyboard and messages', () => {
  it('maps keys to grab, step, drop and cancel, flipping inline arrows in RTL', () => {
    expect(dashboardKeyIntent({ key: 'Enter' }, { active: false })).toEqual({ type: 'grab' });
    expect(dashboardKeyIntent({ key: 'ArrowLeft' }, { active: false })).toBeNull();
    expect(dashboardKeyIntent({ key: 'ArrowLeft' }, { active: true })).toEqual({
      type: 'step',
      dx: -1,
      dy: 0,
    });
    expect(dashboardKeyIntent({ key: 'ArrowLeft' }, { active: true, dir: 'rtl' })).toEqual({
      type: 'step',
      dx: 1,
      dy: 0,
    });
    expect(dashboardKeyIntent({ key: 'ArrowDown' }, { active: true })).toEqual({
      type: 'step',
      dx: 0,
      dy: 1,
    });
    expect(dashboardKeyIntent({ key: ' ' }, { active: true })).toEqual({ type: 'drop' });
    expect(dashboardKeyIntent({ key: 'Escape' }, { active: true })).toMatchObject({
      type: 'cancel',
    });
    expect(dashboardKeyIntent({ key: 'Tab' }, { active: true })).toEqual({
      type: 'cancel',
      keepFocusMove: true,
    });
    expect(dashboardKeyIntent({ key: 'ArrowUp', ctrlKey: true }, { active: true })).toBeNull();
  });

  it('turns pointer travel into whole cells', () => {
    expect(cellFromDelta({ x: 2, y: 1 }, { x: 130, y: -70 }, { width: 100, height: 60 })).toEqual({
      x: 3,
      y: 0,
    });
    expect(
      cellFromDelta({ x: 2, y: 1 }, { x: 130, y: 0 }, { width: 100, height: 60 }, 'rtl')
    ).toEqual({ x: 1, y: 1 });
    expect(
      cellFromDelta({ x: 2, y: 1 }, { x: Number.NaN, y: 0 }, { width: 0, height: 60 })
    ).toEqual({ x: 2, y: 1 });
  });

  it('announces 1-based positions and sizes, localizable', () => {
    const messages = resolveDashboardMessages({ moved: '{item} → {column}/{row}' });
    const values = positionValues({ id: 'a', x: 2, y: 0, w: 4, h: 3 }, 'Revenue');
    expect(formatDashboardMessage(messages.moved, values)).toBe('Revenue → 3/1');
    expect(formatDashboardMessage(messages.resized, values)).toBe(
      'Revenue resized to 4 columns by 3 rows.'
    );
    expect(formatDashboardRefusal(messages, 'locked', values)).toBe(
      'Cannot change Revenue: a locked widget is in the way.'
    );
  });
});

describe('framework-free', () => {
  it('imports no Svelte, DOM framework or other package from the engine', () => {
    const dir = join(import.meta.dirname, '../src/dashboard/engine');
    for (const file of readdirSync(dir)) {
      const source = readFileSync(join(dir, file), 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((match) => match[1]);
      for (const spec of imports)
        expect(spec, `${file} imports ${spec}`).toMatch(/^\.\/[\w-]+\.ts$/);
      expect(source).not.toMatch(/\bdocument\.|\bwindow\./);
    }
  });
});
