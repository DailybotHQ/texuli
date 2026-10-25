// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  type CanvasPoint,
  downsampleCanvasPoints,
} from '../../packages/charts/src/canvas/model.ts';
import { rankSequence } from '../../packages/data/src/engines/board/index.ts';
import { addDays } from '../../packages/data/src/engines/calendar/index.ts';
import {
  compileFilter,
  type GridColumnDef,
  groupRows,
  sortRows,
} from '../../packages/data/src/engines/grid/index.ts';
import { cluster, type MapPoint } from '../../packages/data/src/engines/map/index.ts';
import {
  cascade,
  type Dependency,
  type ScheduleTask,
} from '../../packages/data/src/engines/timeline/index.ts';
import { buildTree, flatten } from '../../packages/data/src/engines/tree/index.ts';
import {
  type CompositionContext2D,
  drawComposition,
} from '../../packages/media/src/composition-canvas/draw.ts';
import type {
  Composition,
  CompositionLayer,
} from '../../packages/media/src/composition-model/index.ts';

declare const process: { env: Record<string, string | undefined> };

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

function nativeSortCalibration(random: () => number): number {
  return bestOfThree(() => Float64Array.from({ length: 100_000 }, random).sort());
}

interface Deal {
  id: string;
  name: string;
  stage: string;
  amountCents: number | null;
  closesOn: string | null;
  won: boolean;
}

const columns: GridColumnDef<Deal>[] = [
  { key: 'name', header: 'Name', type: 'text', width: 240 },
  { key: 'stage', header: 'Stage', type: 'enum', options: ['lead', 'proposal', 'won', 'lost'] },
  { key: 'amount', header: 'Amount', type: 'number', accessor: (deal) => deal.amountCents },
  { key: 'closesOn', header: 'Closes on', type: 'date' },
  { key: 'won', header: 'Won', type: 'boolean' },
];

const deals: Deal[] = (() => {
  const random = createRng('grid-100k');
  const stages = ['lead', 'proposal', 'won', 'lost'];
  return Array.from({ length: 100_000 }, (_, i) => ({
    id: `d${i}`,
    name: `Deal ${Math.floor(random() * 100_000)}`,
    stage: stages[Math.floor(random() * stages.length)] as string,
    amountCents: random() < 0.05 ? null : Math.floor(1000 + random() * 9_999_000),
    closesOn: `2026-${String(1 + Math.floor(random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`,
    won: random() < 0.3,
  }));
})();

describe('serialized performance budgets', () => {
  it('sorts, filters and groups 100k grid rows within calibrated budget', {
    timeout: 60_000,
  }, () => {
    const random = createRng('grid-calibration');
    const baselineMs = nativeSortCalibration(random);
    const factor = Number(process.env.PROTOYARD_PERF_FACTOR ?? 1);
    const budget = Math.max(150 * factor, 30 * baselineMs);
    const sortMs = bestOfThree(() =>
      sortRows(
        deals,
        [
          { key: 'stage', direction: 'asc' },
          { key: 'amount', direction: 'desc' },
        ],
        columns
      )
    );
    const textSortMs = bestOfThree(() =>
      sortRows(deals, [{ key: 'name', direction: 'asc' }], columns)
    );
    const filter = compileFilter(
      {
        type: 'group',
        op: 'and',
        children: [
          { type: 'condition', field: 'stage', operator: 'in', value: ['proposal', 'won'] },
          { type: 'condition', field: 'amount', operator: 'between', value: [50_000, 5_000_000] },
        ],
      },
      columns
    );
    const filterMs = bestOfThree(() => deals.filter(filter));
    const groupMs = bestOfThree(() =>
      groupRows(deals, { by: 'stage', columns, aggregates: [{ key: 'amount', fn: 'sum' }] })
    );
    console.info(
      `grid 100k: sort ${sortMs.toFixed(1)} ms; text sort ${textSortMs.toFixed(1)} ms; filter ${filterMs.toFixed(1)} ms; group ${groupMs.toFixed(1)} ms; budget ${budget.toFixed(0)} ms`
    );
    expect(sortMs).toBeLessThan(budget);
    expect(textSortMs).toBeLessThan(budget);
    expect(filterMs).toBeLessThan(budget);
    expect(groupMs).toBeLessThan(budget);
  });

  it('cascades a 2k-task schedule within calibrated budget', { timeout: 60_000 }, () => {
    const random = createRng('schedule-2k');
    const monday = '2026-10-19';
    const tasks: ScheduleTask[] = [];
    const dependencies: Dependency[] = [];
    for (let i = 0; i < 2_000; i++) {
      tasks.push({
        id: `t${i}`,
        start: addDays(monday, i),
        end: addDays(monday, i + Math.floor(random() * 5)),
      });
      if (i > 0)
        dependencies.push({
          from: `t${Math.max(0, i - 1 - Math.floor(random() * Math.min(5, i)))}`,
          to: `t${i}`,
          type: 'FS',
          lagDays: Math.floor(random() * 3),
        });
    }
    const baselineMs = nativeSortCalibration(createRng('schedule-calibration'));
    let changed = 0;
    const ms = bestOfThree(() => {
      changed = cascade(tasks, dependencies, { id: 't0', start: addDays(monday, 30) }).changes
        .length;
    });
    console.info(
      `schedule cascade 2k: ${ms.toFixed(1)} ms; changed ${changed}; native sort ${baselineMs.toFixed(1)} ms`
    );
    expect(changed).toBeGreaterThan(20);
    const factor = Number(process.env.PROTOYARD_PERF_FACTOR ?? 3);
    expect(ms).toBeLessThan(Math.max(20 * factor, 5 * baselineMs));
  });

  it('flattens 10k tree nodes within calibrated budget', { timeout: 60_000 }, () => {
    interface Node {
      id: string;
      parentId: string | null;
      rank: string;
      title: string;
    }
    const ranks = rankSequence(10_000);
    const nodes: Node[] = Array.from({ length: 10_000 }, (_, i) => ({
      id: `n${i}`,
      parentId: i === 0 ? null : `n${Math.floor((i - 1) / 4)}`,
      rank: ranks[i] as string,
      title: `Node ${i}`,
    }));
    const accessors = {
      id: (node: Node) => node.id,
      parentId: (node: Node) => node.parentId,
      rank: (node: Node) => node.rank,
    };
    const tree = buildTree(nodes, accessors);
    const baselineMs = nativeSortCalibration(createRng('tree-calibration'));
    const ms = bestOfThree(() => flatten(tree, { expanded: 'all' }));
    console.info(`tree flatten 10k: ${ms.toFixed(1)} ms; native sort ${baselineMs.toFixed(1)} ms`);
    expect(flatten(tree, { expanded: 'all' })).toHaveLength(10_000);
    const factor = Number(process.env.PROTOYARD_PERF_FACTOR ?? 1);
    expect(ms).toBeLessThan(Math.max(30 * factor, 3 * baselineMs));
  });

  it('clusters 5k map points within calibrated budget', { timeout: 60_000 }, () => {
    const random = createRng('map-5k');
    const points: MapPoint[] = Array.from({ length: 5_000 }, (_, i) => ({
      id: `p${i}`,
      lng: random() * 360 - 180,
      lat: random() * 160 - 80,
    }));
    const baselineMs = nativeSortCalibration(createRng('map-calibration'));
    const ms = bestOfThree(() => cluster(points, 10, 64));
    console.info(`cluster 5k: ${ms.toFixed(2)} ms; native sort ${baselineMs.toFixed(1)} ms`);
    const factor = Number(process.env.PROTOYARD_PERF_FACTOR ?? 1);
    expect(ms).toBeLessThan(Math.max(10 * factor, 2 * baselineMs));
  });

  it('downsamples a 100k-point canvas chart within budget', { timeout: 60_000 }, () => {
    const points: CanvasPoint[] = Array.from({ length: 100_000 }, (_, x) => ({
      x,
      y: Math.sin(x / 11),
      y0: 300,
    }));
    const random = createRng('chart-calibration');
    const baselineMs = nativeSortCalibration(random);
    const ms = bestOfThree(() => downsampleCanvasPoints(points, 640));
    const result = downsampleCanvasPoints(points, 640);
    console.info(
      `chart downsample 100k: ${ms.toFixed(1)} ms; output ${result.length}; native sort ${baselineMs.toFixed(1)} ms`
    );
    expect(result.length).toBeLessThan(4_000);
    expect(ms).toBeLessThan(Math.max(100, 20 * baselineMs));
  });

  it('draws a 256-layer composition within budget', { timeout: 60_000 }, () => {
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      direction: 'ltr',
      save() {},
      restore() {},
      setTransform() {},
      clearRect() {},
      fillRect() {},
      beginPath() {},
      rect() {},
      ellipse() {},
      moveTo() {},
      lineTo() {},
      fill() {},
      stroke() {},
      clip() {},
      fillText() {},
      measureText: () => ({ width: 1 }),
      drawImage() {},
      createLinearGradient: () => ({}),
      createRadialGradient: () => ({}),
      getImageData: () => ({}),
      putImageData() {},
    } as unknown as CompositionContext2D;
    const layers: CompositionLayer[] = Array.from(
      { length: 256 },
      (_, i) =>
        ({
          id: `layer-${i}`,
          type: 'shape',
          shape: 'rectangle',
          frame: { x: i, y: i, width: 10, height: 10 },
          fill: { kind: 'solid', color: '#336699' },
        }) as CompositionLayer
    );
    const composition: Composition = { version: 1, width: 400, height: 400, layers };
    const ms = bestOfThree(() => drawComposition(context, composition));
    const report = drawComposition(context, composition);
    console.info(`composition draw 256: ${ms.toFixed(1)} ms; drawn ${report.drawn.length}`);
    expect(report.drawn).toHaveLength(256);
    expect(ms).toBeLessThan(250);
  });
});
