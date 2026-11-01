/**
 * Geometry vectors for the native chart and data painters (PLAN_013,
 * ADR-025): fixed fictional inputs run through the web's own public
 * functions (`@texuli/charts`, `@texuli/data`, imported by path as root
 * scripts do), written as
 * `{ fn, input, output }` cases. The Kotlin port replays every case
 * (`ChartMathParityTest` in `native/texuli-compose/src/jvmTest`): numbers to
 * 1e-9, SVG path strings and labels exactly.
 *
 * Usage:
 *   pnpm exec tsx scripts/chart-vectors.ts           # write the vectors
 *   pnpm exec tsx scripts/chart-vectors.ts --check   # exit 1 on drift
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
// Root scripts import packages by path. `math/index.ts` is the `@texuli/charts/math` entry;
// the model modules are what the family entries re-export (those entries also load Svelte).
import {
  createCartesianLayout,
  lineCoordinates,
  windowCartesianSeries,
  xDomain,
} from '../packages/charts/src/cartesian/model.ts';
import { minMaxBuckets } from '../packages/charts/src/math/downsample/min-max.ts';
import {
  bandScale,
  chooseTimeInterval,
  extent,
  floorTime,
  formatCompact,
  formatDate,
  formatNumber,
  formatPercent,
  formatTick,
  formatTimeTick,
  groupOffsets,
  linearScale,
  niceDomain,
  offsetTime,
  sqrtScale,
  stepPrecision,
  type TimeInterval,
  tickStep,
  ticks,
  timeScale,
  timeTicks,
} from '../packages/charts/src/math/index.ts';
import { sunburst } from '../packages/charts/src/math/layout/sunburst.ts';
import { type TreemapNode, treemap } from '../packages/charts/src/math/layout/treemap.ts';
import {
  arcCentroid,
  arcPath,
  areaPath,
  type Curve,
  linePath,
  pie,
  roundCoord,
  stack,
} from '../packages/charts/src/math/shapes/index.ts';
import { centerTotalFits, treeTableRows } from '../packages/charts/src/part-whole/model.ts';
import { biomeFormat } from './generate-surfaces.ts';

const ROOT = resolve(import.meta.dirname, '..');
export const VECTORS_PATH = 'native/conformance/fixtures/chart-vectors.json';

export interface VectorCase {
  fn: string;
  input: unknown;
  output: unknown;
}

/** JSON has no NaN or infinities: they are written as null, which the cases avoid. */
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 2, 2); // 2026-03-02, a Monday

/** Number literals that cover integer, fraction, tie, exponent and negative-zero printing. */
const NUMBERS = [
  0,
  -0,
  1,
  -1,
  12,
  12.5,
  -12.25,
  0.1,
  0.30000000000000004,
  1 / 3,
  2 / 3,
  123456789,
  1e21,
  1.5e21,
  1e-6,
  1e-7,
  1.234e-7,
  5e-324,
  0.000123,
  640,
  618.75,
  1234.5678,
  -0.004,
  99.995,
];

const FORMAT_VALUES = [
  0, 1, -1, 12.345, 1.005, 2.5, -2.5, 0.125, 1234567.891, 999.995, 0.004, -0.004, 1e15, 42, 3.25,
];

const CURVES: readonly Curve[] = ['linear', 'monotone-x', 'step', 'step-before', 'step-after'];

const INTERVALS: readonly TimeInterval[] = [
  { unit: 'second', step: 15 },
  { unit: 'minute', step: 5 },
  { unit: 'hour', step: 3 },
  { unit: 'day', step: 1 },
  { unit: 'day', step: 2 },
  { unit: 'week', step: 1 },
  { unit: 'month', step: 1 },
  { unit: 'month', step: 3 },
  { unit: 'year', step: 1 },
  { unit: 'year', step: 5 },
];

const SAMPLE_TIMES = [
  T0,
  T0 + 9 * 3_600_000 + 37 * 60_000 + 12_000,
  Date.UTC(2024, 1, 29, 23, 59, 59),
  Date.UTC(1999, 11, 31, 12),
  Date.UTC(2026, 9, 27, 9, 5, 7),
];

function coreCases(): VectorCase[] {
  const cases: VectorCase[] = [];
  const add = (fn: string, input: unknown, output: unknown) =>
    cases.push({ fn, input: json(input), output: json(output) });

  for (const value of NUMBERS)
    add('jsNumber', { value: Object.is(value, -0) ? 0 : value }, String(value));
  for (const value of [0.005, 0.015, 1.005, -1.005, 2.675, 12.344999, -0.001, 640.125])
    add('roundCoord', { value }, roundCoord(value));

  const ranges: [number, number, number][] = [
    [0, 1, 10],
    [0, 97, 5],
    [-3.2, 41.7, 5],
    [0.001, 0.0093, 4],
    [1200, 1, 6],
    [0, 0, 5],
    [-1e6, 2.5e6, 7],
    [0.1, 0.7, 3],
  ];
  for (const [start, stop, count] of ranges) {
    add('tickStep', { start, stop, count }, tickStep(start, stop, count));
    add('ticks', { start, stop, count }, ticks(start, stop, count));
    add('niceDomain', { start, stop, count }, niceDomain(start, stop, count));
  }
  for (const step of [1, 0.5, 0.25, 0.1, 0.02, 5, 1000, 0.001])
    add('stepPrecision', { step }, stepPrecision(step));
  add('extent', { values: [3, null, -2, 7.5, 0] }, extent([3, null, -2, 7.5, 0]));
  add('extent', { values: [null] }, extent([null]));

  const probes = [-5, 0, 13.7, 50, 97, 120];
  for (const nice of [false, true, 5]) {
    const scale = linearScale({ domain: [3.2, 96.4], range: [282, 18], nice });
    add(
      'linearScale',
      { domain: [3.2, 96.4], range: [282, 18], nice, probes, inverts: [282, 150, 18] },
      {
        domain: scale.domain,
        values: probes.map(scale),
        invert: [282, 150, 18].map(scale.invert),
        ticks: scale.ticks(5),
      }
    );
  }
  const single = linearScale({ domain: [4, 4], range: [0, 100] });
  add(
    'linearScale',
    { domain: [4, 4], range: [0, 100], nice: false, probes: [4, 9], inverts: [0, 50] },
    {
      domain: single.domain,
      values: [4, 9].map(single),
      invert: [0, 50].map(single.invert),
      ticks: single.ticks(5),
    }
  );
  const sqrt = sqrtScale({ domain: [0, 400], range: [2, 24] });
  add(
    'sqrtScale',
    { domain: [0, 400], range: [2, 24], probes: [0, 1, 100, 400] },
    { values: [0, 1, 100, 400].map(sqrt) }
  );

  for (const [domain, range, paddingInner, paddingOuter, align] of [
    [['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], [58, 622], 0.18, 0.1, 0.5],
    [['a'], [0, 100], 0, 0, 0.5],
    [['a', 'b', 'c'], [300, 0], 0.2, 0.5, 0],
    [[], [0, 100], 0.1, 0.1, 0.5],
  ] as [string[], [number, number], number, number, number][]) {
    const scale = bandScale({ domain, range, paddingInner, paddingOuter, align });
    add(
      'bandScale',
      { domain, range, paddingInner, paddingOuter, align },
      { starts: domain.map((key) => scale(key)), bandwidth: scale.bandwidth(), step: scale.step() }
    );
  }

  const matrix = [
    [3, -2, null, 5],
    [1, 4, 2, -3],
    [null, 2, 6, 1],
  ];
  for (const offset of ['none', 'expand', 'diverging'] as const)
    add('stack', { series: matrix, offset }, stack(matrix, { offset }));
  for (const [bandwidth, count, padding] of [
    [80, 3, 0.1],
    [40, 1, 0.1],
    [0, 2, 0.1],
    [60, 4, 0.95],
  ])
    add('groupOffsets', { bandwidth, count, padding }, groupOffsets(bandwidth, count, padding));

  const points = [
    { x: 58, y: 120.456 },
    { x: 140.333, y: 80 },
    { x: 222.5, y: null },
    { x: 304, y: 200.125 },
    { x: 386.75, y: 60 },
    { x: 468, y: 140 },
  ];
  const area = points.map((p) => ({ x: p.x, y0: 272, y1: p.y }));
  for (const curve of CURVES) {
    add('linePath', { points, curve }, linePath(points, { curve }));
    add('areaPath', { points: area, curve }, areaPath(area, { curve }));
  }
  add('linePath', { points: [{ x: 1, y: 2 }], curve: 'linear' }, linePath([{ x: 1, y: 2 }]));

  for (const [start, stop, count] of [
    [T0, T0 + 7 * DAY, 6],
    [T0, T0 + 3 * 3_600_000, 6],
    [T0, T0 + 400 * DAY, 6],
    [T0, T0 + 30 * 365 * DAY, 6],
    [T0, T0 + 90_000, 4],
    [T0, T0, 6],
  ])
    add('chooseTimeInterval', { start, stop, count }, chooseTimeInterval(start, stop, count));
  for (const interval of INTERVALS)
    for (const ms of SAMPLE_TIMES) {
      add(
        'floorTime',
        { ms, interval, weekStartsOn: 1 },
        floorTime(ms, interval, { weekStartsOn: 1 })
      );
      add('offsetTime', { ms, interval, count: 2 }, offsetTime(ms, interval, 2));
      add('formatTimeTick', { ms, interval }, formatTimeTick(ms, interval));
    }
  add(
    'floorTime',
    { ms: T0 + 3 * DAY, interval: { unit: 'week', step: 1 }, weekStartsOn: 0 },
    floorTime(T0 + 3 * DAY, { unit: 'week', step: 1 }, { weekStartsOn: 0 })
  );
  add(
    'offsetTime',
    { ms: Date.UTC(2026, 0, 31), interval: { unit: 'month', step: 1 }, count: 1 },
    offsetTime(Date.UTC(2026, 0, 31), { unit: 'month', step: 1 }, 1)
  );
  for (const [start, stop] of [
    [T0, T0 + 10 * DAY],
    [T0 + 5 * 3_600_000, T0 + 2 * DAY],
    [Date.UTC(2025, 10, 3), Date.UTC(2026, 7, 9)],
    [Date.UTC(2001, 0, 1), Date.UTC(2026, 0, 1)],
  ]) {
    const interval = chooseTimeInterval(start, stop, 6);
    add(
      'timeTicks',
      { start, stop, interval },
      timeTicks(start, stop, interval, { weekStartsOn: 1 })
    );
    const scale = timeScale({ domain: [start, stop], range: [58, 622], nice: true });
    add(
      'timeScale',
      { domain: [start, stop], range: [58, 622], nice: true, probes: [start, stop] },
      {
        domain: scale.domain,
        values: [start, stop].map(scale),
      }
    );
  }
  for (const ms of SAMPLE_TIMES) {
    add('formatDate', { ms, withTime: false }, formatDate(ms));
    add('formatDate', { ms, withTime: true }, formatDate(ms, { withTime: true }));
  }

  for (const value of FORMAT_VALUES) {
    for (const maximumFractionDigits of [0, 1, 2])
      add(
        'formatNumber',
        { value, maximumFractionDigits, minimumFractionDigits: 0, signed: false },
        formatNumber(value, { maximumFractionDigits })
      );
    add(
      'formatNumber',
      { value, maximumFractionDigits: 2, minimumFractionDigits: 2, signed: true },
      formatNumber(value, { maximumFractionDigits: 2, minimumFractionDigits: 2, signed: true })
    );
    add('formatPercent', { value, digits: 1 }, formatPercent(value));
  }
  for (const [value, step] of [
    [0.25, 0.25],
    [1000, 200],
    [0.1, 0.02],
    [-2, 0.5],
    [12, 1],
  ])
    add('formatTick', { value, step }, formatTick(value, step));
  for (const value of [
    0, 999, 1000, 1234, -1234, 12_345, 99_950, 999_950, 1_250_000, 3.4e9, 7.25e12, 0.5,
  ])
    add('formatCompact', { value }, formatCompact(value));
  return cases;
}

const CARTESIAN_SERIES = [
  {
    id: 'opened',
    label: 'Opened',
    points: [
      { x: 'Mon', y: 210 },
      { x: 'Tue', y: 198 },
      { x: 'Wed', y: null },
      { x: 'Thu', y: 176 },
      { x: 'Fri', y: 164 },
    ],
  },
  {
    id: 'solved',
    label: 'Solved',
    points: [
      { x: 'Mon', y: 190 },
      { x: 'Tue', y: -12 },
      { x: 'Wed', y: 201 },
      { x: 'Thu', y: 188 },
      { x: 'Fri', y: 172 },
    ],
  },
];

const NUMERIC_SERIES = [
  {
    id: 'load',
    label: 'Load',
    points: [
      { x: 3, y: 0.4 },
      { x: 1, y: 0.25 },
      { x: 8, y: 0.9 },
    ],
  },
];

function cartesianLayoutCases(): VectorCase[] {
  const cases: VectorCase[] = [];
  for (const [series, stacked] of [
    [CARTESIAN_SERIES, false],
    [CARTESIAN_SERIES, true],
    [NUMERIC_SERIES, false],
  ] as const) {
    const layout = createCartesianLayout(series, 640, 320, stacked);
    cases.push({
      fn: 'createCartesianLayout',
      input: json({ series, width: 640, height: 320, stacked }),
      output: json({
        xKeys: layout.xKeys,
        xPositions: layout.xKeys.map(layout.xPosition),
        yProbes: [-20, 0, 100, 250].map(layout.yPosition),
        baseline: layout.baseline,
        stacked: layout.stacked,
        paths: series.map((_, index) => lineCoordinates(layout, index, true)),
      }),
    });
  }
  const wide = {
    id: 'wide',
    label: 'Wide',
    points: [9, 2, 4, 7, 1, 12, 5].map((x, index) => ({ x, y: index * 3 })),
  };
  for (const domain of [
    [2, 7],
    [4.5, 4.8],
    [20, 30],
  ] as [number, number][])
    cases.push({
      fn: 'windowCartesianSeries',
      input: json({ series: [wide], domain }),
      output: json(windowCartesianSeries([wide], domain)),
    });
  cases.push({
    fn: 'xDomain',
    input: json({ series: CARTESIAN_SERIES }),
    output: json(xDomain(CARTESIAN_SERIES)),
  });
  cases.push({ fn: 'xDomain', input: json({ series: [wide] }), output: json(xDomain([wide])) });
  const xs = Array.from({ length: 64 }, (_, index) => index * 1.5);
  const ys = xs.map((x, index) =>
    index === 20 ? Number.NaN : Math.round(Math.sin(x) * 1000) / 10
  );
  for (const [buckets, x0, x1] of [
    [8, undefined, undefined],
    [100, undefined, undefined],
    [5, 10, 60],
  ] as [number, number | undefined, number | undefined][])
    cases.push({
      fn: 'minMaxBuckets',
      input: json({
        xs,
        ys: ys.map((y) => (Number.isFinite(y) ? y : null)),
        buckets,
        x0: x0 ?? null,
        x1: x1 ?? null,
      }),
      output: json(minMaxBuckets(xs, ys, { buckets, x0, x1 })),
    });
  return cases;
}

const TREE: TreemapNode = {
  id: 'support',
  label: 'Support',
  children: [
    {
      id: 'email',
      label: 'Email',
      children: [
        { id: 'billing', label: 'Billing', value: 42 },
        { id: 'login', label: 'Login', value: 18 },
        { id: 'empty', value: 0 },
      ],
    },
    { id: 'chat', label: 'Chat', value: 61 },
    { id: 'phone', value: 7.5 },
    {
      id: 'social',
      label: 'Social',
      children: [
        { id: 'x-dm', value: 3 },
        { id: 'forum', value: 9 },
      ],
    },
  ],
};

function partWholeCases(): VectorCase[] {
  const cases: VectorCase[] = [];
  const add = (fn: string, input: unknown, output: unknown) =>
    cases.push({ fn, input: json(input), output: json(output) });
  for (const [values, padAngle] of [
    [[42, 18, null, 61, -4, 7.5], 0.01],
    [[1], 0.2],
    [[0, 0], 0],
    [[5, 1e-6, 5], 0.4],
  ] as [(number | null)[], number][])
    add('pie', { values, padAngle }, pie(values, { padAngle }));
  for (const options of [
    { innerRadius: 0, outerRadius: 108, startAngle: 0, endAngle: 1.2, padAngle: 0 },
    { innerRadius: 62.64, outerRadius: 108, startAngle: 1.2, endAngle: 4.1, padAngle: 0.01 },
    { innerRadius: 0, outerRadius: 108, startAngle: 0, endAngle: Math.PI * 2, padAngle: 0 },
    { innerRadius: 30, outerRadius: 108, startAngle: 0, endAngle: Math.PI * 2, padAngle: 0 },
    { innerRadius: 40, outerRadius: 100, startAngle: 0.3, endAngle: 2.2, cornerRadius: 6 },
    { innerRadius: 0, outerRadius: 100, startAngle: 0.3, endAngle: 0.9, cornerRadius: 50 },
    { innerRadius: 10, outerRadius: 100, startAngle: 1, endAngle: 1, padAngle: 0 },
  ])
    add('arcPath', options, arcPath(options));
  add(
    'arcCentroid',
    { innerRadius: 20, outerRadius: 100, startAngle: 0.5, endAngle: 2 },
    arcCentroid({ innerRadius: 20, outerRadius: 100, startAngle: 0.5, endAngle: 2 })
  );
  for (const [width, height, padding] of [
    [640, 360, 2],
    [300, 500, 0],
    [120, 40, 8],
  ])
    add(
      'treemap',
      { root: TREE, width, height, padding },
      treemap(TREE, { width, height, padding })
    );
  for (const [radius, innerRadius, padAngle] of [
    [115.2, 27.648, 0],
    [100, 0, 0.02],
  ])
    add(
      'sunburst',
      { root: TREE, radius, innerRadius, padAngle },
      sunburst(TREE, { radius, innerRadius, padAngle })
    );
  add('treeTableRows', { root: TREE }, treeTableRows(TREE));
  for (const [text, innerRadius, fontSize] of [
    ['1,234.5', 62.64, 12.79],
    ['138.5', 20, 12.79],
  ] as [string, number, number][])
    add(
      'centerTotalFits',
      { text, innerRadius, fontSize },
      centerTotalFits(text, innerRadius, fontSize)
    );
  return cases;
}

/** Every case, in a stable order: the shared core first, then each family's model. */
export function buildVectors(): VectorCase[] {
  return [...coreCases(), ...cartesianLayoutCases(), ...partWholeCases()];
}

export function renderVectors(cases: readonly VectorCase[], root = ROOT): string {
  const doc = {
    $comment:
      'Generated by scripts/chart-vectors.ts from the web chart and data functions. Do not edit by hand. The Kotlin port replays every case (ADR-025).',
    cases,
  };
  return biomeFormat(VECTORS_PATH, `${JSON.stringify(doc, null, 2)}\n`, root);
}

function main(argv: readonly string[]): number {
  const cases = buildVectors();
  const text = renderVectors(cases);
  const target = join(ROOT, VECTORS_PATH);
  if (argv.includes('--check')) {
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current !== text) {
      console.error('chart vectors are out of date: run pnpm exec tsx scripts/chart-vectors.ts');
      return 1;
    }
    console.log(`chart vectors are current (${cases.length} cases)`);
    return 0;
  }
  writeFileSync(target, text);
  console.log(`wrote chart vectors (${cases.length} cases)`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main(process.argv.slice(2));
}
