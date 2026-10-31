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

  // G122: a nudge grows past a wider (or taller) blocker instead of stopping at it.
  const report: DashboardItem[] = [
    { id: 'revenue', x: 0, y: 0, w: 8, h: 3 },
    { id: 'signups', x: 8, y: 0, w: 4, h: 3 },
    { id: 'funnel', x: 0, y: 3, w: 12, h: 4 },
  ];
  const vertical = { columns: 12, compaction: 'vertical' } as const;

  it('moves a widget down past a wider one below it, to the cell moveItem accepts (G122)', () => {
    const down = nudgeItem(report, 'revenue', { dx: 0, dy: 1 }, vertical);
    const moved = moveItem(report, 'revenue', { x: 0, y: 7 }, vertical);
    expect(down.ok && down.item).toMatchObject({ x: 0, y: 7 });
    expect(down.ok && moved.ok && place(down.layout)).toEqual(moved.ok && place(moved.layout));
    if (down.ok) assertValid(down.layout, 12);
    // Below everything now: the next step down is the real edge.
    expect(down.ok && nudgeItem(down.layout, 'revenue', { dx: 0, dy: 1 }, vertical)).toEqual({
      ok: false,
      reason: 'edge',
    });
  });

  it('moves a widget up past a wider one above it, and sideways past a taller one (G122)', () => {
    const below = [
      { id: 'funnel', x: 0, y: 0, w: 12, h: 4 },
      { id: 'revenue', x: 0, y: 4, w: 8, h: 3 },
      { id: 'signups', x: 8, y: 4, w: 4, h: 3 },
    ];
    const up = nudgeItem(below, 'revenue', { dx: 0, dy: -1 }, vertical);
    expect(up.ok && up.item).toMatchObject({ x: 0, y: 0 });
    expect(up.ok && at(up.layout, 'funnel')?.y).toBeGreaterThanOrEqual(3);
    const side = [
      { id: 'kpi', x: 0, y: 0, w: 4, h: 2 },
      { id: 'tall', x: 4, y: 0, w: 4, h: 8 },
    ];
    let layout: DashboardLayout = side;
    for (let x = 1; x <= 8; x += 1) {
      const right = nudgeItem(layout, 'kpi', { dx: 1, dy: 0 }, vertical);
      expect(right.ok && right.item.x).toBe(x);
      if (!right.ok) return;
      assertValid(right.layout, 12);
      layout = right.layout;
    }
    expect(nudgeItem(layout, 'kpi', { dx: 1, dy: 0 }, vertical)).toEqual({
      ok: false,
      reason: 'edge',
    });
    for (let x = 7; x >= 0; x -= 1) {
      const left = nudgeItem(layout, 'kpi', { dx: -1, dy: 0 }, vertical);
      expect(left.ok && left.item.x).toBe(x);
      if (!left.ok) return;
      layout = left.layout;
    }
  });

  it('swaps the widget below above it when a narrower one above holds its row (G122)', () => {
    const held = [
      { id: 'post', x: 4, y: 0, w: 1, h: 3 },
      { id: 'wide', x: 3, y: 3, w: 9, h: 2 },
      { id: 'note', x: 6, y: 5, w: 6, h: 2 },
    ];
    const down = nudgeItem(held, 'wide', { dx: 0, dy: 1 }, vertical);
    expect(down.ok && place(down.layout)).toEqual({
      post: [4, 0, 1, 3],
      note: [6, 0, 6, 2],
      wide: [3, 3, 9, 2],
    });
    expect(down.ok && nudgeItem(down.layout, 'wide', { dx: 0, dy: 1 }, vertical)).toEqual({
      ok: false,
      reason: 'edge',
    });
  });

  it('hops over a locked widget in the way instead of refusing (G122)', () => {
    const pinned = [
      { id: 'kpi', x: 0, y: 0, w: 4, h: 2 },
      { id: 'pin', x: 4, y: 0, w: 4, h: 2, locked: true },
    ];
    const right = nudgeItem(pinned, 'kpi', { dx: 1, dy: 0 }, vertical);
    expect(right.ok && right.item).toMatchObject({ x: 8, y: 0 });
  });

  it('every nudge on a random layout moves the widget that way or stops at a real edge (G122)', () => {
    let seed = 122;
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const steps = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (let round = 0; round < 60; round += 1) {
      const compaction = round % 3 === 0 ? 'none' : 'vertical';
      const options = { columns: 12, compaction } as const;
      const input = Array.from({ length: 2 + random(7) }, (_, i) => ({
        id: `w${i}`,
        x: random(12),
        y: random(10),
        w: 1 + random(12),
        h: 1 + random(5),
      }));
      const { layout } = normalizeLayout(input, options);
      for (const item of layout) {
        for (const step of steps) {
          const result = nudgeItem(layout, item.id, step, options);
          if (result.ok) {
            assertValid(result.layout, 12);
            if (step.dx === 0) expect(result.item.x, `${item.id} x`).toBe(item.x);
            if (step.dx) expect(Math.sign(result.item.x - item.x)).toBe(step.dx);
            // Vertically it moves that way, or holds its row while the widget it passes swaps.
            const movedY = Math.sign(result.item.y - item.y);
            if (step.dy && movedY !== step.dy) {
              expect(movedY, `${item.id} y`).toBe(0);
              expect(place(result.layout)).not.toEqual(place(layout));
            }
            expect(result.item.w).toBe(item.w);
            continue;
          }
          expect(result.reason).toBe('edge');
          if (step.dx < 0) expect(item.x).toBe(0);
          if (step.dx > 0) expect(item.x + item.w).toBe(12);
          if (step.dy < 0 && compaction === 'none') expect(item.y).toBe(0);
          // Up with vertical compaction: nothing above it in its columns to pass.
          if (step.dy < 0 && compaction === 'vertical') {
            const above = layout.some(
              (other) =>
                other.id !== item.id &&
                other.y < item.y &&
                other.x < item.x + item.w &&
                item.x < other.x + other.w
            );
            expect(above, `${item.id} up`).toBe(false);
          }
          // Down: nothing in its columns below it, so compaction would pull it back.
          if (step.dy > 0) {
            const below = layout.some(
              (other) =>
                other.id !== item.id &&
                other.y + other.h > item.y + item.h &&
                other.x < item.x + item.w &&
                item.x < other.x + other.w
            );
            expect(below || compaction === 'none', `${item.id} down`).toBe(false);
          }
        }
      }
    }
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
    expect(parsed.issues.map((issue) => issue.code)).toEqual(['dropped', 'clamped', 'dropped']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('lists every clamped number as an issue with its path, and nothing for numbers that fit', () => {
    const parsed = parseDashboard(
      {
        format: 'texuli-dashboard',
        formatVersion: 1,
        layouts: {
          lg: [
            { id: 'a', x: 0, y: 0, w: 400, h: 2 },
            { id: 'b', x: -3, y: 1e9, w: 2, h: 0, minW: 0, maxH: 999 },
            { id: 'c', x: 0, y: 4, w: 'wide', h: 2.4 },
            { id: 'd', x: 4, y: 6, w: 3, h: 2, minW: 2, maxW: 6, minH: 1, maxH: 4 },
          ],
        },
      },
      { breakpoints: dashboardBreakpoints(12) }
    );
    const clamped = parsed.issues.filter((issue) => issue.code === 'clamped');
    expect(clamped.map((issue) => issue.path).sort()).toEqual(
      [
        'layouts.lg[0].w',
        'layouts.lg[1].h',
        'layouts.lg[1].maxH',
        'layouts.lg[1].minW',
        'layouts.lg[1].x',
        'layouts.lg[1].y',
        'layouts.lg[2].w',
      ].sort()
    );
    const first = clamped.find((issue) => issue.path === 'layouts.lg[0].w');
    expect(first?.message).toContain('12');
    expect(parsed.issues.every((issue) => typeof issue.code === 'string')).toBe(true);
    // A valid stored dashboard reports nothing.
    const json = serializeDashboard({ lg: base, sm: reflowLayout(base, 12, 1) });
    expect(parseDashboard(json, { breakpoints: dashboardBreakpoints(12) }).issues).toEqual([]);
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
