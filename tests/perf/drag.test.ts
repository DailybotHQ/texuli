import { describe, expect, it } from 'vitest';
import { edgeHitArea, edgePath, hitEdge } from '../../packages/drag/src/graph.ts';
import { applyModifiers, restrictToBounds, snapToGrid } from '../../packages/drag/src/modifiers.ts';
import {
  createSortable,
  createSortableSnapshot,
  type SortableContainer,
} from '../../packages/drag/src/sortable.ts';
import { measureList } from '../../packages/drag/src/testing.ts';

declare const process: { env: Record<string, string | undefined> };

/*
 * @texuli/drag at scale: one pointer event of a 1,000-item sortable runs
 * the session move, a modifier chain, collision (list choice + midpoint
 * binary search or nearest center for grids), the move plan and the
 * announcement. Every event below crosses a midpoint, so the plan reruns
 * each time (the worst case). The budget per event is a slice of a 60 Hz
 * frame (16.7 ms), scaled by the machine baseline like the other perf files:
 * best of three after a warm-up, calibrated against a native 100k sort.
 */

function createRng(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function bestOfThree(work: () => unknown): number {
  work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

const random = createRng('drag-engine');
const baselineMs = bestOfThree(() => Float64Array.from({ length: 100_000 }, random).sort());
const budget = (floorMs: number, factor: number) => Math.max(floorMs, factor * baselineMs);
const report = (name: string, ms: number) => {
  if (process.env.TEXULI_PERF_REPORT === '1') {
    console.log(`[perf] ${name}: ${ms.toFixed(3)} ms (baseline ${baselineMs.toFixed(1)} ms)`);
  }
};

/** Per-event cost must stay well inside one frame: 2 ms of 16.7 ms, scaled for slow hosts. */
const perEventBudget = () => budget(2, 0.1);
const ITEM_HEIGHT = 40;

const list = (
  id: string,
  n: number,
  extra: Partial<SortableContainer> = {}
): SortableContainer => ({
  id,
  items: Array.from({ length: n }, (_, i) => `${id}-${i}`),
  ...extra,
});

/** Drives `events` pointer moves through a fresh controller; returns ms per event. */
function drag(
  containers: readonly SortableContainer[],
  snapshotOf: () => ReturnType<typeof createSortableSnapshot>,
  path: (step: number) => { x: number; y: number },
  events: number
): number {
  const snapshot = snapshotOf();
  const bounds = restrictToBounds({ x: 0, y: 0, width: 4000, height: 50_000 });
  const grid = snapToGrid(1);
  let announced = 0;
  const ms = bestOfThree(() => {
    const sortable = createSortable({
      containers,
      transform: (delta) =>
        applyModifiers([bounds, grid], delta, {
          activeRect: { x: 0, y: 0, width: 200, height: ITEM_HEIGHT },
        }),
      announce: () => {
        announced += 1;
      },
    });
    sortable.pickUp(containers[0]?.items[0] as string, { point: { x: 10, y: 10 } });
    for (let step = 0; step < events; step += 1) sortable.pointerMove(path(step), snapshot);
    sortable.drop();
  });
  expect(announced).toBeGreaterThan(events);
  return ms / events;
}

describe('drag engine within a frame budget', () => {
  it('1,000-item vertical sortable: move + collision per pointer event', () => {
    const a = list('a', 1000);
    const perEvent = drag(
      [a],
      () => createSortableSnapshot([measureList(a, { itemHeight: ITEM_HEIGHT })]),
      (step) => ({ x: 50, y: 10 + ((step * 41) % (1000 * ITEM_HEIGHT)) }),
      1000
    );
    report('vertical 1,000 per event', perEvent);
    expect(perEvent).toBeLessThan(perEventBudget());
  });

  it('1,000-item grid sortable (nearest-center collision)', () => {
    const g = list('g', 1000, { orientation: 'grid' });
    const perEvent = drag(
      [g],
      () =>
        createSortableSnapshot([
          measureList(g, { orientation: 'grid', columns: 10, itemWidth: 100 }),
        ]),
      (step) => ({ x: 25 + ((step * 53) % 1000), y: 20 + ((step * 7) % 100) * ITEM_HEIGHT }),
      1000
    );
    report('grid 1,000 per event', perEvent);
    expect(perEvent).toBeLessThan(perEventBudget());
  });

  it('1,000 items across a 4-column board (cross-list plans)', () => {
    const columns = ['c0', 'c1', 'c2', 'c3'].map((id) => list(id, 250, { group: 'board' }));
    const perEvent = drag(
      columns,
      () =>
        createSortableSnapshot(
          columns.map((c, i) => measureList(c, { x: i * 260, itemHeight: ITEM_HEIGHT }))
        ),
      (step) => ({ x: 30 + (step % 4) * 260, y: 10 + ((step * 37) % (250 * ITEM_HEIGHT)) }),
      1000
    );
    report('board 4×250 per event', perEvent);
    expect(perEvent).toBeLessThan(perEventBudget());
  });

  it('edge hit-testing over 2,000 edges per pointer event', () => {
    const areas = Array.from({ length: 2000 }, (_, i) =>
      edgeHitArea(
        `e${i}`,
        edgePath(
          { x: (i % 50) * 120, y: Math.floor(i / 50) * 80 },
          { x: (i % 50) * 120 + 100, y: Math.floor(i / 50) * 80 + 60 }
        )
      )
    );
    const events = 200;
    let hits = 0;
    const ms = bestOfThree(() => {
      for (let step = 0; step < events; step += 1) {
        if (hitEdge(areas, { x: (step * 97) % 6000, y: (step * 31) % 3200 }, 6)) hits += 1;
      }
    });
    report('edge hit 2,000 per event', ms / events);
    expect(hits).toBeGreaterThanOrEqual(0);
    expect(ms / events).toBeLessThan(perEventBudget());
  });
});
