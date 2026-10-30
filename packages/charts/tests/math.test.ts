// @vitest-environment node

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  annotationInteractionSeries,
  assertChartAnnotations,
  type ChartAnnotation,
  projectAnnotations,
} from '../src/annotations/model.ts';
import { categoricalColor, divergingColor, sequentialColor } from '../src/colors/index.ts';
import {
  type ChartFormatSpec,
  formatChartValue,
  MAX_CACHED_FORMATTERS,
} from '../src/compact/shared.ts';
import { nearestPoint2d } from '../src/interaction/model.ts';
import {
  arcCentroid,
  arcPath,
  areaPath,
  bandScale,
  bin,
  bisectLeft,
  bisectX,
  type ChartPoint,
  calendarLayout,
  chooseTimeInterval,
  downsampleThreshold,
  floorTime,
  formatCents,
  formatCompact,
  formatDate,
  formatNumber,
  formatPercent,
  formatTick,
  formatTimeTick,
  funnelLayout,
  gaugeLayout,
  groupOffsets,
  largestTriangleThreeBuckets,
  linearScale,
  linePath,
  logScale,
  lttbIndices,
  matrixLayout,
  minMaxBuckets,
  niceDomain,
  ordinalScale,
  pack,
  pie,
  plotArea,
  pointScale,
  roundCoord,
  SankeyError,
  SYMBOL_TYPES,
  sankey,
  sqrtScale,
  stack,
  stackExtent,
  stepPrecision,
  sturges,
  sunburst,
  symbolPath,
  TreemapError,
  tickStep,
  ticks,
  timeScale,
  timeTicks,
  treemap,
} from '../src/math/index.ts';
import { fitChartWidth, MIN_CHART_WIDTH } from '../src/math/layout/fit-width.ts';
import { appendSeriesWindow } from '../src/streaming/index.ts';

/** Deterministic mulberry32 PRNG (no @texuli/core dependency in math tests). */
function createRng(seed: string): { float(min: number, max: number): number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 1;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return {
    float(min: number, max: number) {
      return min + (max - min) * next();
    },
  };
}

const utc = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();

describe('theme color scales', () => {
  it('maps categorical indices to the eight chart token slots and wraps negatives; selects stable sequential and diverging token stops with bounded inputs', () => {
    // maps categorical indices to the eight chart token slots and wraps negatives
    expect(categoricalColor(0)).toBe('var(--tx-chart-1, var(--tx-primary, CanvasText))');
    expect(categoricalColor(8)).toBe(categoricalColor(0));
    expect(categoricalColor(-1)).toBe('var(--tx-chart-8, var(--tx-link, CanvasText))');
    expect(categoricalColor(Number.NaN)).toBe(categoricalColor(0));
    // selects stable sequential and diverging token stops with bounded inputs
    expect(sequentialColor(0)).toContain('--tx-chart-sequential-1');
    expect(sequentialColor(0.5)).toContain('--tx-chart-sequential-5');
    expect(sequentialColor(0.5)).toContain('color-mix(in oklab');
    expect(sequentialColor(2)).toContain('--tx-chart-sequential-9');
    expect(sequentialColor(Number.NaN)).toBe(sequentialColor(0));
    expect(divergingColor(-1)).toContain('--tx-chart-diverging-1');
    expect(divergingColor(0)).toBe('var(--tx-chart-diverging-5, var(--tx-background, Canvas))');
    expect(divergingColor(1)).toContain('--tx-chart-diverging-9');
    expect(divergingColor(-0.25)).toContain('var(--tx-destructive');
    expect(divergingColor(0.25)).toContain('var(--tx-success');
    expect(divergingColor(-2)).toBe(divergingColor(-1));
  });
});

describe('linear ticks', () => {
  it('uses 1/2/5 steps for known domains; handles negative, reversed, empty and one-point domains; nices domains outward', () => {
    // uses 1/2/5 steps for known domains
    expect(ticks(0, 10, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ticks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(ticks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(ticks(0, 0.3, 3)).toEqual([0, 0.1, 0.2, 0.3]);
    expect(tickStep(0, 1000, 4)).toBe(200);
    // handles negative, reversed, empty and one-point domains
    expect(ticks(-10, 10, 4)).toEqual([-10, -5, 0, 5, 10]);
    expect(ticks(10, 0, 2)).toEqual([10, 5, 0]);
    expect(ticks(5, 5, 10)).toEqual([5]);
    expect(ticks(Number.NaN, 1)).toEqual([]);
    // nices domains outward
    expect(niceDomain(0.13, 9.7, 10)).toEqual([0, 10]);
    expect(niceDomain(-3.2, 47, 5)).toEqual([-10, 50]);
    expect(niceDomain(97, 3, 10)).toEqual([100, 0]);
    expect(stepPrecision(0.25)).toBe(1);
    expect(stepPrecision(0.05)).toBe(2);
    expect(stepPrecision(20)).toBe(0);
  });
});

describe('linearScale', () => {
  it('maps, inverts and ticks; nices and clamps; puts a one-value domain mid-range instead of dividing by zero', () => {
    {
      // maps, inverts and ticks
      const y = linearScale({ domain: [0, 200], range: [300, 0] });
      expect(y(0)).toBe(300);
      expect(y(50)).toBe(225);
      expect(y.invert(225)).toBe(50);
      for (const v of [0, 13, 77.5, 200]) expect(y.invert(y(v))).toBeCloseTo(v, 10);
      expect(y.ticks(4)).toEqual([0, 50, 100, 150, 200]);
    }
    {
      // nices and clamps
      const x = linearScale({ domain: [3, 97], range: [0, 100], nice: true, clamp: true });
      expect(x.domain).toEqual([0, 100]);
      expect(x(150)).toBe(100);
      expect(x.invert(-20)).toBe(0);
    }
    {
      // puts a one-value domain mid-range instead of dividing by zero
      const x = linearScale({ domain: [4, 4], range: [0, 100] });
      expect(x(4)).toBe(50);
      expect(x(9)).toBe(50);
      expect(x.invert(10)).toBe(4);
      expect(x.ticks()).toEqual([4]);
    }
  });
});

describe('sqrtScale and logScale', () => {
  it('sqrt maps areas, mirrors negatives and inverts, and 2 related cases', () => {
    {
      // sqrt maps areas, mirrors negatives and inverts
      const r = sqrtScale({ domain: [0, 100], range: [0, 20] });
      expect(r(25)).toBe(10);
      expect(r.invert(10)).toBeCloseTo(25, 10);
      const s = sqrtScale({ domain: [-100, 100], range: [-10, 10] });
      expect(s(-25)).toBeCloseTo(-5, 10);
    }
    {
      // log maps decades evenly and ticks powers and multiples
      const x = logScale({ domain: [1, 1000], range: [0, 300] });
      expect(x(10)).toBeCloseTo(100, 10);
      expect(x.invert(200)).toBeCloseTo(100, 8);
      expect(x.ticks(10).slice(0, 4)).toEqual([1, 2, 3, 4]);
      expect(x.ticks(10)).toContain(1000);
      const wide = logScale({ domain: [1, 1e9], range: [0, 900] });
      expect(wide.ticks(5)).toEqual([1, 100, 10_000, 1_000_000, 100_000_000]);
    }
    {
      // log nices to powers, supports negative domains and rejects zero
      expect(logScale({ domain: [3, 870], range: [0, 1], nice: true }).domain).toEqual([1, 1000]);
      const neg = logScale({ domain: [-1000, -1], range: [0, 300] });
      expect(neg(-10)).toBeCloseTo(200, 10);
      expect(neg.ticks(10)[0]).toBe(-1000);
      expect(neg.ticks(10).at(-1)).toBe(-1);
      expect(() => logScale({ domain: [0, 10], range: [0, 1] })).toThrow(RangeError);
      expect(() => logScale({ domain: [-1, 10], range: [0, 1] })).toThrow(RangeError);
    }
  });
});

describe('time scales (UTC)', () => {
  it('chooses intervals by span, and 4 related cases', () => {
    // chooses intervals by span
    expect(chooseTimeInterval(utc('2026-03-01T00:00:00Z'), utc('2026-03-01T01:00:00Z'), 6)).toEqual(
      {
        unit: 'minute',
        step: 15,
      }
    );
    expect(chooseTimeInterval(utc('2026-03-01T00:00:00Z'), utc('2026-03-08T00:00:00Z'), 7)).toEqual(
      {
        unit: 'day',
        step: 1,
      }
    );
    expect(
      chooseTimeInterval(utc('2026-01-01T00:00:00Z'), utc('2027-01-01T00:00:00Z'), 12)
    ).toEqual({
      unit: 'month',
      step: 1,
    });
    expect(chooseTimeInterval(utc('2026-01-01T00:00:00Z'), utc('2028-01-01T00:00:00Z'), 8)).toEqual(
      {
        unit: 'month',
        step: 3,
      }
    );
    expect(
      chooseTimeInterval(utc('2000-01-01T00:00:00Z'), utc('2026-01-01T00:00:00Z'), 6).unit
    ).toBe('year');
    {
      // month ticks land on the first of each month across DST changes
      // US and EU DST switches fall in March and late October/November.
      const values = timeTicks(utc('2026-02-15T12:00:00Z'), utc('2026-11-20T00:00:00Z'), {
        unit: 'month',
        step: 1,
      });
      expect(values.map(iso)).toEqual([
        '2026-03-01T00:00:00.000Z',
        '2026-04-01T00:00:00.000Z',
        '2026-05-01T00:00:00.000Z',
        '2026-06-01T00:00:00.000Z',
        '2026-07-01T00:00:00.000Z',
        '2026-08-01T00:00:00.000Z',
        '2026-09-01T00:00:00.000Z',
        '2026-10-01T00:00:00.000Z',
        '2026-11-01T00:00:00.000Z',
      ]);
    }
    // aligns quarters, weeks (Monday by default) and hour steps
    expect(
      timeTicks(utc('2026-01-10T00:00:00Z'), utc('2026-12-31T00:00:00Z'), {
        unit: 'month',
        step: 3,
      }).map(iso)
    ).toEqual(['2026-04-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z']);
    // 2026-03-04 is a Wednesday.
    expect(iso(floorTime(utc('2026-03-04T10:00:00Z'), { unit: 'week', step: 1 }))).toBe(
      '2026-03-02T00:00:00.000Z'
    );
    expect(
      iso(floorTime(utc('2026-03-04T10:00:00Z'), { unit: 'week', step: 1 }, { weekStartsOn: 0 }))
    ).toBe('2026-03-01T00:00:00.000Z');
    expect(
      timeTicks(utc('2026-03-02T01:00:00Z'), utc('2026-03-02T13:00:00Z'), {
        unit: 'hour',
        step: 6,
      }).map(iso)
    ).toEqual(['2026-03-02T06:00:00.000Z', '2026-03-02T12:00:00.000Z']);
    {
      // timeScale maps, inverts, nices and reports its tick interval
      const start = utc('2026-03-01T00:00:00Z');
      const end = utc('2026-03-31T00:00:00Z');
      const x = timeScale({ domain: [start, end], range: [0, 300] });
      expect(x(start)).toBe(0);
      expect(x(end)).toBe(300);
      const mid = utc('2026-03-16T00:00:00Z');
      expect(x.invert(x(mid))).toBeCloseTo(mid, 0);
      expect(x.tickInterval(5)).toEqual({ unit: 'week', step: 1 });
      expect(x.ticks(5).map(iso)[0]).toBe('2026-03-02T00:00:00.000Z');

      const nice = timeScale({
        domain: [utc('2026-03-01T03:20:00Z'), utc('2026-03-01T21:40:00Z')],
        range: [0, 100],
        nice: true,
      });
      expect(nice.domain.map(iso)).toEqual([
        '2026-03-01T03:00:00.000Z',
        '2026-03-02T00:00:00.000Z',
      ]);
    }
    {
      // a one-instant domain yields that instant as its only tick when aligned
      const t = utc('2026-03-02T00:00:00Z');
      expect(timeTicks(t, t, { unit: 'day', step: 1 })).toEqual([t]);
    }
  });
});

describe('band and point scales', () => {
  it('lays out bands with padding and inverts positions to keys, and 2 related cases', () => {
    {
      // lays out bands with padding and inverts positions to keys
      const x = bandScale({
        domain: ['a', 'b', 'c', 'd'],
        range: [0, 100],
        paddingInner: 0.2,
        paddingOuter: 0.1,
      });
      const step = 100 / (4 - 0.2 + 0.2);
      expect(x.step()).toBeCloseTo(step, 10);
      expect(x.bandwidth()).toBeCloseTo(step * 0.8, 10);
      expect(x('a')).toBeCloseTo(step * 0.1, 10);
      expect(x('d')).toBeCloseTo(step * 0.1 + step * 3, 10);
      expect(x('zzz' as 'a')).toBeUndefined();
      expect(x.invert((x('c') as number) + 1)).toBe('c');
      expect(x.invert(-50)).toBeUndefined();
    }
    {
      // supports reversed ranges, duplicates and empty domains
      const x = bandScale({ domain: ['a', 'b', 'a'], range: [100, 0] });
      expect(x.domain).toEqual(['a', 'b']);
      expect(x('a')).toBe(50);
      expect(x('b')).toBe(0);
      expect(x.invert(75)).toBe('a');
      expect(x.invert(25)).toBe('b');
      const empty = bandScale({ domain: [], range: [0, 100] });
      expect(empty.bandwidth()).toBe(0);
      expect(empty.invert(10)).toBeUndefined();
    }
    {
      // point scales space keys evenly with zero bandwidth
      const p = pointScale({ domain: ['mon', 'tue', 'wed'], range: [0, 200] });
      expect([p('mon'), p('tue'), p('wed')]).toEqual([0, 100, 200]);
      expect(p.bandwidth()).toBe(0);
      expect(p.invert(140)).toBe('tue');
      const padded = pointScale({ domain: ['a', 'b'], range: [0, 300], padding: 1 });
      expect([padded('a'), padded('b')]).toEqual([100, 200]);
    }
  });
});

describe('formatters', () => {
  it('formats numbers, compact numbers and ticks, and 3 related cases', () => {
    // formats numbers, compact numbers and ticks
    expect(formatNumber(1234.567)).toBe('1,234.57');
    expect(formatNumber(12, { signed: true })).toBe('+12');
    expect(formatCompact(1234)).toBe('1.2K');
    expect(formatCompact(3_400_000)).toBe('3.4M');
    expect(formatTick(0.5, 0.25)).toBe('0.5');
    expect(formatTick(2, 0.5)).toBe('2.0');
    expect(formatTick(1500, 500)).toBe('1,500');
    // formats integer cents and rejects fractional cents
    expect(formatCents(123_456)).toBe('$1,234.56');
    expect(formatCents(-500, 'USD', { signed: true })).toBe('-$5.00');
    expect(formatCents(1200, 'USD', { trimZeroCents: true })).toBe('$12');
    expect(formatCents(1_234_500, 'USD', { compact: true })).toBe('$12.3K');
    expect(formatCents(99_00, 'EUR', { locale: 'de-DE' })).toBe('99,00\u00a0€');
    expect(() => formatCents(12.5)).toThrow(RangeError);
    // formats percentages
    expect(formatPercent(0.125)).toBe('12.5%');
    expect(formatPercent(0.04, { signed: true, digits: 0 })).toBe('+4%');
    {
      // formats UTC time ticks by interval, independent of the host zone
      const t = utc('2026-03-02T09:15:30Z');
      expect(formatTimeTick(t, { unit: 'year', step: 1 })).toBe('2026');
      expect(formatTimeTick(t, { unit: 'month', step: 1 })).toBe('Mar 2026');
      expect(formatTimeTick(utc('2026-07-01T00:00:00Z'), { unit: 'month', step: 3 })).toBe(
        'Q3 2026'
      );
      expect(formatTimeTick(t, { unit: 'day', step: 1 })).toBe('Mar 2');
      expect(formatTimeTick(t, { unit: 'hour', step: 1 })).toBe('09:15');
      expect(formatTimeTick(t, { unit: 'second', step: 15 })).toBe('09:15:30');
      expect(formatDate(t)).toBe('Mar 2, 2026');
      expect(formatDate(t, { withTime: true })).toBe('Mar 2, 2026, 09:15');
    }
  });
});

const pts = [
  { x: 0, y: 10 },
  { x: 10, y: 0 },
  { x: 20, y: 5 },
  { x: 30, y: 5 },
];

/** End point of every command (M, L, C, A), skipping arc radii and control points. */
const coords = (d: string): (readonly [number, number])[] =>
  [...d.matchAll(/([MLCA])([^MLCAZ]*)/g)].map((m) => {
    const nums = (m[2] as string).split(',').map(Number);
    return [nums.at(-2) as number, nums.at(-1) as number] as const;
  });

describe('linePath', () => {
  it('draws linear and step curves; draws a monotone curve that never overshoots its points; breaks at gaps and honours `defined`; rounds coordinates to two decimals', () => {
    // draws linear and step curves
    expect(linePath(pts)).toBe('M0,10L10,0L20,5L30,5');
    expect(linePath(pts, { curve: 'step' })).toBe(
      'M0,10L5,10L5,0L10,0L15,0L15,5L20,5L25,5L25,5L30,5'
    );
    expect(linePath(pts, { curve: 'step-after' })).toBe('M0,10L10,10L10,0L20,0L20,5L30,5L30,5');
    expect(linePath(pts, { curve: 'step-before' })).toBe('M0,10L0,0L10,0L10,5L20,5L20,5L30,5');
    {
      // draws a monotone curve that never overshoots its points
      const d = linePath(pts, { curve: 'monotone-x' });
      expect(d).toBe('M0,10C3.33,5,6.67,0,10,0C13.33,0,16.67,5,20,5C23.33,5,26.67,5,30,5');
      // Control points included: a monotone curve stays inside each segment's y range.
      const controlYs = d
        .split('C')
        .slice(1)
        .flatMap((c) =>
          c
            .split(',')
            .filter((_, i) => i % 2 === 1)
            .map(Number)
        );
      expect(controlYs).toHaveLength(9);
      for (const y of controlYs) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(10);
      }
      // Two points fall back to a straight cubic-free segment.
      expect(linePath(pts.slice(0, 2), { curve: 'monotone-x' })).toBe('M0,10L10,0');
    }
    {
      // breaks at gaps and honours `defined`
      const gappy = [
        { x: 0, y: 1 },
        { x: 1, y: null },
        { x: 2, y: 3 },
        { x: 3, y: Number.NaN },
        { x: 4, y: 5 },
        { x: 5, y: 6 },
      ];
      expect(linePath(gappy)).toBe('M0,1ZM2,3ZM4,5L5,6');
      expect(linePath(pts, { defined: (p) => p.y !== 0 })).toBe('M0,10ZM20,5L30,5');
      expect(linePath([])).toBe('');
      expect(linePath([{ x: 0, y: null }])).toBe('');
    }
    // rounds coordinates to two decimals
    expect(
      linePath([
        { x: 0.123456, y: 1 / 3 },
        { x: 2, y: -0.0001 },
      ])
    ).toBe('M0.12,0.33L2,0');
    expect(roundCoord(1.005)).toBe(1);
  });
});

describe('areaPath', () => {
  it('closes each run along its baseline; mirrors step curves on the baseline so stacked steps line up', () => {
    {
      // closes each run along its baseline
      const area = [
        { x: 0, y0: 20, y1: 10 },
        { x: 10, y0: 20, y1: 0 },
        { x: 20, y0: 20, y1: null },
        { x: 30, y0: 20, y1: 5 },
        { x: 40, y0: 18, y1: 4 },
      ];
      expect(areaPath(area)).toBe('M0,10L10,0L10,20L0,20ZM30,5L40,4L40,18L30,20Z');
    }
    {
      // mirrors step curves on the baseline so stacked steps line up
      const area = [
        { x: 0, y0: 10, y1: 5 },
        { x: 10, y0: 8, y1: 2 },
      ];
      expect(areaPath(area, { curve: 'step-after' })).toBe('M0,5L10,5L10,2L10,8L10,10L0,10Z');
    }
  });
});

describe('stack', () => {
  const series = [
    [10, 20, -5],
    [5, null, 10],
    [5, 10, -5],
  ];
  it('stacks cumulatively in series order; expands to 100% using absolute values; diverges negatives below zero without overlap; groups bars inside a band', () => {
    // stacks cumulatively in series order
    expect(stack(series)).toEqual([
      [
        [0, 10],
        [0, 20],
        [0, -5],
      ],
      [
        [10, 15],
        [20, 20],
        [-5, 5],
      ],
      [
        [15, 20],
        [20, 30],
        [5, 0],
      ],
    ]);
    {
      // expands to 100% using absolute values
      const out = stack(series, { offset: 'expand' });
      expect(out.map((s) => s[0])).toEqual([
        [0, 0.5],
        [0.5, 0.75],
        [0.75, 1],
      ]);
      expect(out[2]?.[2]?.[1]).toBeCloseTo(1, 10);
      expect(stack([[0], [0]], { offset: 'expand' })).toEqual([[[0, 0]], [[0, 0]]]);
    }
    {
      // diverges negatives below zero without overlap
      const out = stack(series, { offset: 'diverging' });
      expect(out.map((s) => s[2])).toEqual([
        [-5, 0],
        [0, 10],
        [-10, -5],
      ]);
      expect(stackExtent(out)).toEqual([-10, 30]);
    }
    {
      // groups bars inside a band
      const g = groupOffsets(100, 3, 0.25);
      expect(g.width).toBeCloseTo((100 / 2.75) * 0.75, 10);
      expect((g.offsets.at(-1) as number) + g.width).toBeCloseTo(100, 10);
      expect(g.offsets[0]).toBe(0);
      expect(groupOffsets(40, 1).width).toBeCloseTo(40, 10);
      expect(groupOffsets(40, 0)).toEqual({ offsets: [], width: 0 });
    }
  });
});

describe('pie and arcs', () => {
  it('splits the circle proportionally in input order, sorting only the placement, and 4 related cases', () => {
    {
      // splits the circle proportionally in input order, sorting only the placement
      const slices = pie([1, 3, 0, null, -2]);
      expect(slices.map((s) => s.value)).toEqual([1, 3, 0, 0, 0]);
      expect(slices[0]?.startAngle).toBe(0);
      expect(slices[0]?.endAngle).toBeCloseTo(Math.PI / 2, 10);
      expect(slices[1]?.endAngle).toBeCloseTo(Math.PI * 2, 10);
      const sorted = pie([1, 3], { sort: 'desc' });
      expect(sorted[1]?.startAngle).toBe(0);
      expect(sorted[0]?.startAngle).toBeCloseTo(1.5 * Math.PI, 10);
      expect(pie([2, 2], { padAngle: 0.1 }).every((s) => s.padAngle === 0.1)).toBe(true);
      expect(pie([5], { padAngle: 0.1 })[0]?.padAngle).toBe(0);
    }
    // draws pie slices, donut slices and full rings
    expect(arcPath({ innerRadius: 0, outerRadius: 10, startAngle: 0, endAngle: Math.PI / 2 })).toBe(
      'M0,-10A10,10,0,0,1,10,0L0,0Z'
    );
    expect(arcPath({ innerRadius: 5, outerRadius: 10, startAngle: 0, endAngle: Math.PI })).toBe(
      'M0,-10A10,10,0,0,1,0,10L0,5A5,5,0,0,0,0,-5Z'
    );
    expect(
      arcPath({ innerRadius: 0, outerRadius: 10, startAngle: 0, endAngle: 1.5 * Math.PI })
    ).toContain('A10,10,0,1,1');
    expect(arcPath({ innerRadius: 4, outerRadius: 8, startAngle: 0, endAngle: Math.PI * 2 })).toBe(
      'M0,-8A8,8,0,1,1,0,8A8,8,0,1,1,0,-8ZM0,-4A4,4,0,1,0,0,4A4,4,0,1,0,0,-4Z'
    );
    expect(arcPath({ innerRadius: 0, outerRadius: 10, startAngle: 1, endAngle: 1 })).toBe('');
    {
      // rounds corners with arcs tangent to the rim, keeping every point inside the ring
      const d = arcPath({
        innerRadius: 20,
        outerRadius: 40,
        startAngle: 0,
        endAngle: Math.PI / 2,
        cornerRadius: 4,
      });
      expect(d.match(/A4,4/g)).toHaveLength(4);
      for (const [x, y] of coords(d)) {
        const r = Math.hypot(x, y);
        if (r > 1) {
          expect(r).toBeGreaterThanOrEqual(20 - 0.02);
          expect(r).toBeLessThanOrEqual(40 + 0.02);
        }
      }
      // A thin slice clamps the corner radius instead of folding over.
      const thin = arcPath({
        innerRadius: 0,
        outerRadius: 40,
        startAngle: 0,
        endAngle: 0.05,
        cornerRadius: 30,
      });
      const radius = Number(/A(\d+(?:\.\d+)?),/.exec(thin)?.[1]);
      expect(radius).toBeLessThan(1.1);
    }
    {
      // trims pad angles and finds label centroids
      const padded = arcPath({
        innerRadius: 0,
        outerRadius: 10,
        startAngle: 0,
        endAngle: Math.PI / 2,
        padAngle: 0.2,
      });
      const [start] = coords(padded);
      expect(start?.[0]).toBeCloseTo(roundCoord(10 * Math.sin(0.1)), 2);
      expect(
        arcCentroid({ innerRadius: 0, outerRadius: 10, startAngle: 0, endAngle: Math.PI })
      ).toEqual([5, 0]);
    }
    {
      // keeps a positive slice visible when the pad angle would consume it
      // A sliver next to a dominant slice: its own pad may never exceed half
      // its sweep, so the slice still renders (the legend and table list it).
      const slices = pie([1000, 1], { padAngle: 0.01 });
      const sliver = slices[1] as {
        value: number;
        startAngle: number;
        endAngle: number;
        padAngle: number;
      };
      expect(sliver.value).toBe(1);
      expect(sliver.padAngle).toBeGreaterThan(0);
      expect(sliver.padAngle).toBeLessThanOrEqual((sliver.endAngle - sliver.startAngle) / 2);
      expect(
        arcPath({
          innerRadius: 0,
          outerRadius: 100,
          startAngle: sliver.startAngle,
          endAngle: sliver.endAngle,
          padAngle: sliver.padAngle,
        })
      ).not.toBe('');
      // Direct arcPath callers (sunburst arcs, gauge bands) get the same
      // guarantee: padding trims at most half the span away.
      expect(
        arcPath({ innerRadius: 5, outerRadius: 10, startAngle: 0, endAngle: 0.004, padAngle: 0.01 })
      ).not.toBe('');
    }
  });
});

describe('symbols', () => {
  it('draws every symbol centred on its point', () => {
    for (const type of SYMBOL_TYPES) {
      const d = symbolPath(type, 50, 50, 100);
      const xs = coords(d).map(([x]) => x);
      const ys = coords(d).map(([, y]) => y);
      expect((Math.min(...xs) + Math.max(...xs)) / 2, type).toBeCloseTo(50, 0);
      if (type !== 'triangle')
        expect((Math.min(...ys) + Math.max(...ys)) / 2, type).toBeCloseTo(50, 0);
    }
    expect(symbolPath('square', 0, 0, 16)).toBe('M-2,-2L2,-2L2,2L-2,2Z');
  });
});

describe('bin', () => {
  it('uses Sturges with nice edges and counts every value once; accepts explicit thresholds, counts and domains', () => {
    {
      // uses Sturges with nice edges and counts every value once
      const values = [1, 2, 2, 3, 3, 3, 4, 4, 9.5, 10, null, Number.NaN];
      const bins = bin(values);
      expect(sturges(10)).toBe(5);
      expect(bins.map((b) => [b.x0, b.x1])).toEqual([
        [0, 2],
        [2, 4],
        [4, 6],
        [6, 8],
        [8, 10],
      ]);
      expect(bins.map((b) => b.count)).toEqual([1, 5, 2, 0, 2]);
      expect(bins.reduce((s, b) => s + b.count, 0)).toBe(10);
    }
    // accepts explicit thresholds, counts and domains
    expect(bin([1, 5, 9], { thresholds: [4, 8] }).map((b) => [b.x0, b.x1, b.count])).toEqual([
      [1, 4, 1],
      [4, 8, 1],
      [8, 9, 1],
    ]);
    expect(bin([0.1, 0.25, 0.9], { count: 2 }).map((b) => b.x1)).toEqual([0.5, 1]);
    expect(bin([5, 50], { domain: [0, 10], count: 2 }).map((b) => b.count)).toEqual([0, 1]);
    expect(bin([3, 3, 3]).map((b) => [b.x0, b.x1, b.count])).toEqual([[3, 3, 3]]);
    expect(bin([])).toEqual([]);
  });
});

const area = (r: { x0: number; y0: number; x1: number; y1: number }) =>
  (r.x1 - r.x0) * (r.y1 - r.y0);

describe('treemap', () => {
  const root = {
    id: 'all',
    children: [
      { id: 'a', value: 6 },
      { id: 'b', value: 6 },
      { id: 'c', value: 4 },
      { id: 'd', value: 3 },
      { id: 'e', value: 2 },
      { id: 'f', value: 2 },
      { id: 'g', value: 1 },
    ],
  };
  it('gives each leaf an area proportional to its value, tiling the whole box, and 3 related cases', () => {
    {
      // gives each leaf an area proportional to its value, tiling the whole box
      const rects = treemap(root, { width: 600, height: 400 });
      const leaves = rects.filter((r) => r.leaf);
      expect(rects[0]).toMatchObject({
        id: 'all',
        depth: 0,
        parentId: null,
        value: 24,
        x0: 0,
        y0: 0,
        x1: 600,
        y1: 400,
      });
      expect(leaves).toHaveLength(7);
      for (const leaf of leaves) expect(area(leaf)).toBeCloseTo((leaf.value / 24) * 600 * 400, 6);
      expect(leaves.reduce((s, r) => s + area(r), 0)).toBeCloseTo(600 * 400, 6);
      for (const leaf of leaves) {
        expect(leaf.x0).toBeGreaterThanOrEqual(-1e-9);
        expect(leaf.y1).toBeLessThanOrEqual(400 + 1e-9);
      }
    }
    {
      // keeps rectangles reasonably square (the point of squarifying)
      const many = {
        id: 'r',
        children: Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, value: 30 - i })),
      };
      const worst = Math.max(
        ...treemap(many, { width: 800, height: 500 })
          .filter((r) => r.leaf)
          .map((r) => Math.max((r.x1 - r.x0) / (r.y1 - r.y0), (r.y1 - r.y0) / (r.x1 - r.x0)))
      );
      expect(worst).toBeLessThan(4);
    }
    {
      // nests children inside their parent with padding
      const rects = treemap(
        {
          id: 'r',
          children: [
            {
              id: 'p',
              children: [
                { id: 'x', value: 1 },
                { id: 'y', value: 1 },
              ],
            },
            { id: 'q', value: 2 },
          ],
        },
        { width: 200, height: 100, padding: 4, paddingTop: 16 }
      );
      const p = rects.find((r) => r.id === 'p');
      const x = rects.find((r) => r.id === 'x');
      if (!p || !x) throw new Error('missing rects');
      expect(x.parentId).toBe('p');
      expect(x.depth).toBe(2);
      expect(x.x0).toBeGreaterThanOrEqual(p.x0 + 4 - 1e-9);
      expect(x.y0).toBeGreaterThanOrEqual(p.y0 + 16 - 1e-9);
    }
    // validates sums, values and ids
    expect(() =>
      treemap({ id: 'r', value: 5, children: [{ id: 'a', value: 2 }] }, { width: 1, height: 1 })
    ).toThrow(TreemapError);
    expect(() =>
      treemap({ id: 'r', children: [{ id: 'a', value: -1 }] }, { width: 1, height: 1 })
    ).toThrow(/finite value/);
    expect(() =>
      treemap({ id: 'r', children: [{ id: 'r', value: 1 }] }, { width: 1, height: 1 })
    ).toThrow(/duplicate/);
    // A matching parent value and an all-zero tree are fine.
    expect(
      treemap({ id: 'r', value: 2, children: [{ id: 'a', value: 2 }] }, { width: 10, height: 10 })
    ).toHaveLength(2);
    expect(
      treemap({ id: 'r', children: [{ id: 'a', value: 0 }] }, { width: 10, height: 10 })[1]
    ).toMatchObject({ x0: 0, x1: 0 });
  });
});

describe('sankey', () => {
  const nodes = ['visit', 'signup', 'bounce', 'trial', 'paid', 'churn'].map((id) => ({ id }));
  const links = [
    { source: 'visit', target: 'signup', value: 60 },
    { source: 'visit', target: 'bounce', value: 40 },
    { source: 'signup', target: 'trial', value: 45 },
    { source: 'signup', target: 'churn', value: 15 },
    { source: 'trial', target: 'paid', value: 30 },
    { source: 'trial', target: 'churn', value: 15 },
  ];
  const layout = sankey(nodes, links, { width: 600, height: 300, nodeWidth: 10, nodePadding: 10 });
  const node = (id: string) =>
    layout.nodes.find((n) => n.id === id) as (typeof layout.nodes)[number];
  it('places nodes in columns by longest path with sinks on the right, and 4 related cases', () => {
    // places nodes in columns by longest path with sinks on the right
    expect(Object.fromEntries(layout.nodes.map((n) => [n.id, n.depth]))).toEqual({
      visit: 0,
      signup: 1,
      bounce: 3,
      trial: 2,
      paid: 3,
      churn: 3,
    });
    expect(node('visit').x0).toBe(0);
    expect(node('paid').x1).toBe(600);
    {
      // conserves flow: node height equals the links on each side
      const height = (id: string) => node(id).y1 - node(id).y0;
      const widths = (pick: (l: (typeof layout.links)[number]) => boolean) =>
        layout.links.filter(pick).reduce((s, l) => s + l.width, 0);
      for (const id of ['signup', 'trial']) {
        expect(node(id).value).toBe(
          links.filter((l) => l.target === id).reduce((s, l) => s + l.value, 0)
        );
        expect(widths((l) => l.target === id)).toBeCloseTo(height(id), 1);
        expect(widths((l) => l.source === id)).toBeCloseTo(height(id), 1);
      }
      expect(node('churn').value).toBe(30);
    }
    {
      // keeps every node inside the area without overlaps in a column
      for (const n of layout.nodes) {
        expect(n.y0).toBeGreaterThanOrEqual(-0.01);
        expect(n.y1).toBeLessThanOrEqual(300.01);
      }
      const last = layout.nodes.filter((n) => n.depth === 3).sort((a, b) => a.y0 - b.y0);
      for (let i = 1; i < last.length; i++) {
        expect(last[i]?.y0).toBeGreaterThanOrEqual((last[i - 1]?.y1 as number) + 10 - 0.02);
      }
      expect(layout.links[0]?.path).toMatch(/^M10,[\d.]+C/);
    }
    {
      // rejects cycles, unknown nodes and bad values with typed errors
      const cycle = () =>
        sankey(
          [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
          [
            { source: 'a', target: 'b', value: 1 },
            { source: 'b', target: 'c', value: 1 },
            { source: 'c', target: 'a', value: 1 },
          ],
          { width: 100, height: 100 }
        );
      expect(cycle).toThrow(SankeyError);
      try {
        cycle();
      } catch (error) {
        expect((error as SankeyError).code).toBe('cycle');
        expect([...(error as SankeyError).nodes].sort()).toEqual(['a', 'b', 'c']);
      }
      expect(() =>
        sankey([{ id: 'a' }], [{ source: 'a', target: 'z', value: 1 }], { width: 1, height: 1 })
      ).toThrow(/unknown node "z"/);
      expect(() =>
        sankey([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b', value: 0 }], {
          width: 1,
          height: 1,
        })
      ).toThrow(/value > 0/);
    }
    // is deterministic
    expect(sankey(nodes, links, { width: 600, height: 300 })).toEqual(
      sankey(nodes, links, { width: 600, height: 300 })
    );
  });
});

describe('funnelLayout', () => {
  const steps = [
    { id: 'visit', value: 1000 },
    { id: 'signup', value: 400 },
    { id: 'activate', value: 0 },
    { id: 'pay', value: 0 },
  ];
  it('computes conversion and drop-off, null where the base is zero; sizes and centres bars in either orientation', () => {
    {
      // computes conversion and drop-off, null where the base is zero
      const out = funnelLayout(steps, { width: 300, height: 200, gap: 8 });
      expect(out.map((s) => s.conversion)).toEqual([1, 0.4, 0, 0]);
      expect(out.map((s) => s.stepConversion)).toEqual([1, 0.4, 0, null]);
      expect(out.map((s) => s.dropOff)).toEqual([0, 600, 400, 0]);
      expect(out.map((s) => s.dropOffRate)).toEqual([0, 0.6, 1, null]);
    }
    {
      // sizes and centres bars in either orientation
      const vertical = funnelLayout(steps.slice(0, 2), { width: 300, height: 108, gap: 8 });
      expect(vertical[0]).toMatchObject({ x: 0, y: 0, width: 300, height: 50 });
      expect(vertical[1]).toMatchObject({ x: 90, y: 58, width: 120, height: 50 });
      const horizontal = funnelLayout(steps.slice(0, 2), {
        width: 108,
        height: 200,
        gap: 8,
        orientation: 'horizontal',
      });
      expect(horizontal[1]).toMatchObject({ x: 58, y: 120, width: 50, height: 80 });
      // A zero step keeps a minimum size so it stays visible and focusable.
      expect(funnelLayout(steps, { width: 300, height: 200 })[2]?.width).toBe(2);
      expect(funnelLayout([], { width: 1, height: 1 })).toEqual([]);
    }
  });
});

describe('calendarLayout and matrixLayout', () => {
  it('lays out a year in week columns: 53 for 2026, 54 for 2012 with Monday weeks, and 2 related cases', () => {
    {
      // lays out a year in week columns: 53 for 2026, 54 for 2012 with Monday weeks
      const y2026 = calendarLayout({ start: '2026-01-01', end: '2026-12-31' });
      expect(y2026.cells).toHaveLength(365);
      expect(y2026.weeks).toBe(53);
      // 2026-01-01 is a Thursday: row 3 when weeks start on Monday.
      expect(y2026.cells[0]).toMatchObject({
        date: '2026-01-01',
        week: 0,
        weekday: 3,
        value: null,
      });
      expect(y2026.months).toHaveLength(12);
      expect(y2026.months[1]).toEqual({ month: '2026-02', week: 4 });
      // Leap year starting on a Sunday spans 54 Monday-based weeks.
      expect(calendarLayout({ start: '2012-01-01', end: '2012-12-31' }).weeks).toBe(54);
      expect(
        calendarLayout({ start: '2012-01-01', end: '2012-12-31' }, { weekStartsOn: 0 }).weeks
      ).toBe(53);
    }
    {
      // keeps missing days null and zero days zero, and positions cells
      const out = calendarLayout(
        { start: '2026-03-01', end: '2026-03-03' },
        { values: { '2026-03-01': 0, '2026-03-02': 7 }, cellSize: 10, gap: 2, weekStartsOn: 0 }
      );
      expect(out.cells.map((c) => [c.date, c.value, c.week, c.weekday, c.x, c.y])).toEqual([
        ['2026-03-01', 0, 0, 0, 0, 0],
        ['2026-03-02', 7, 0, 1, 0, 12],
        ['2026-03-03', null, 0, 2, 0, 24],
      ]);
      expect(out.width).toBe(10);
      expect(out.height).toBe(82);
      expect(calendarLayout({ start: '2026-03-02', end: '2026-03-01' }).cells).toEqual([]);
      expect(() => calendarLayout({ start: 'nope', end: '2026-03-01' })).toThrow(RangeError);
    }
    {
      // builds an equal-cell matrix
      const m = matrixLayout(['w1', 'w2'], ['d0', 'd1', 'd2'], { width: 92, height: 41, gap: 1 });
      expect(m.cellWidth).toBe(30);
      expect(m.cellHeight).toBe(20);
      expect(m.cells).toHaveLength(6);
      expect(m.cells[5]).toMatchObject({ row: 'w2', col: 'd2', x: 62, y: 21 });
      expect(plotArea(100, 50, { top: 5, right: 5, bottom: 5, left: 5 })).toEqual({
        x: 5,
        y: 5,
        width: 90,
        height: 40,
      });
    }
  });
});

describe('gaugeLayout', () => {
  it('maps the value onto the sweep and finds its threshold band; clamps values, ignores thresholds outside the range and rejects empty ranges', () => {
    {
      // maps the value onto the sweep and finds its threshold band
      const g = gaugeLayout(72, { thresholds: [60, 85] });
      expect(g.ratio).toBeCloseTo(0.72, 10);
      expect(g.angle).toBeCloseTo(-0.75 * Math.PI + 0.72 * 1.5 * Math.PI, 10);
      expect(g.valueArc.startAngle).toBeCloseTo(-0.75 * Math.PI, 10);
      expect(g.bands.map((b) => [b.from, b.to])).toEqual([
        [0, 60],
        [60, 85],
        [85, 100],
      ]);
      expect(g.band).toBe(1);
      expect(gaugeLayout(100, { thresholds: [60, 85] }).band).toBe(2);
      expect(gaugeLayout(60, { thresholds: [60, 85] }).band).toBe(1);
    }
    // clamps values, ignores thresholds outside the range and rejects empty ranges
    expect(gaugeLayout(150).value).toBe(100);
    expect(gaugeLayout(Number.NaN).value).toBe(0);
    expect(gaugeLayout(-5, { min: -10, max: 10, thresholds: [-20, 0, 0, 30] }).bands).toHaveLength(
      2
    );
    expect(() => gaugeLayout(1, { min: 5, max: 5 })).toThrow(RangeError);
  });
});

/** A noisy daily-like series with one spike up and one outage dip, from a fixed seed. */
function spikeSeries(
  n: number,
  seed = 'charts-downsample'
): { xs: Float64Array; ys: Float64Array } {
  const rng = createRng(seed);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = i * 60_000;
    ys[i] = 100 + Math.sin(i / 50) * 20 + rng.float(-5, 5);
  }
  ys[Math.floor(n * 0.3)] = 1000;
  ys[Math.floor(n * 0.7)] = -500;
  return { xs, ys };
}

const toPoints = (xs: ArrayLike<number>, ys: ArrayLike<number>): ChartPoint[] =>
  Array.from({ length: xs.length }, (_, i) => ({ x: xs[i] as number, y: ys[i] as number }));

describe('lttbIndices', () => {
  it('keeps first and last, returns the requested count, ascending, and 3 related cases', () => {
    {
      // keeps first and last, returns the requested count, ascending
      const { xs, ys } = spikeSeries(10_000);
      const kept = lttbIndices(xs, ys, 1000);
      expect(kept).toHaveLength(1000);
      expect(kept[0]).toBe(0);
      expect(kept.at(-1)).toBe(9999);
      for (let i = 1; i < kept.length; i++) expect(kept[i]).toBeGreaterThan(kept[i - 1] as number);
    }
    {
      // preserves the extremes of a spike series
      const { xs, ys } = spikeSeries(10_000);
      const kept = lttbIndices(xs, ys, 500);
      expect(kept).toContain(3000);
      expect(kept).toContain(7000);
    }
    {
      // is deterministic and accepts plain or typed arrays alike
      const { xs, ys } = spikeSeries(5000);
      const typed = lttbIndices(xs, ys, 300);
      expect(lttbIndices(xs, ys, 300)).toEqual(typed);
      expect(lttbIndices(Array.from(xs), Array.from(ys), 300)).toEqual(typed);
      expect(lttbIndices(new Float32Array(xs), new Float32Array(ys), 300)).toHaveLength(300);
    }
    {
      // returns every index when n <= threshold and handles tiny thresholds
      expect(lttbIndices([1, 2, 3], [4, 5, 6], 10)).toEqual([0, 1, 2]);
      const { xs, ys } = spikeSeries(100);
      expect(lttbIndices(xs, ys, 2)).toEqual([0, 99]);
      expect(lttbIndices(xs, ys, 1)).toEqual([0]);
      expect(lttbIndices(xs, ys, 0)).toEqual([]);
      expect(lttbIndices([], [], 10)).toEqual([]);
    }
  });
});

describe('largestTriangleThreeBuckets', () => {
  it('returns the same array reference when nothing needs dropping; downsamples points, keeping the original objects and the spike; keeps gaps so lines still break', () => {
    {
      // returns the same array reference when nothing needs dropping
      const points = [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
      ];
      expect(largestTriangleThreeBuckets(points, 10)).toBe(points);
    }
    {
      // downsamples points, keeping the original objects and the spike
      const { xs, ys } = spikeSeries(10_000);
      const points = toPoints(xs, ys).map((p, i) => ({ ...p, id: `p${i}` }));
      const out = largestTriangleThreeBuckets(points, 800);
      expect(out.length).toBeLessThanOrEqual(800);
      expect(out.length).toBeGreaterThan(700);
      expect(out[0]).toBe(points[0]);
      expect(out.at(-1)).toBe(points.at(-1));
      expect(out.map((p) => p.id)).toContain('p3000');
    }
    {
      // keeps gaps so lines still break
      const { xs, ys } = spikeSeries(3000);
      const points: ChartPoint[] = toPoints(xs, ys);
      for (let i = 1000; i < 1100; i++) points[i] = { x: xs[i] as number, y: null };
      const out = largestTriangleThreeBuckets(points, 300);
      const nulls = out.filter((p) => p.y === null);
      expect(nulls).toHaveLength(1);
      expect(nulls[0]?.x).toBe(xs[1000]);
      expect(out[0]).toBe(points[0]);
      expect(out.at(-1)).toBe(points.at(-1));
      expect(out.length).toBeLessThanOrEqual(302);
      expect(
        largestTriangleThreeBuckets(
          [
            { x: 0, y: null },
            { x: 1, y: null },
          ],
          1
        )
      ).toEqual([]);
    }
  });
});

describe('minMaxBuckets', () => {
  it('keeps first, min, max and last per column, preserving spikes and dips; drops samples outside the visible range and keeps one gap marker per column', () => {
    {
      // keeps first, min, max and last per column, preserving spikes and dips
      const { xs, ys } = spikeSeries(100_000);
      const kept = minMaxBuckets(xs, ys, { buckets: 800 });
      expect(kept.length).toBeLessThanOrEqual(800 * 4);
      expect(kept).toContain(30_000);
      expect(kept).toContain(70_000);
      expect(kept[0]).toBe(0);
      expect(kept.at(-1)).toBe(99_999);
      for (let i = 1; i < kept.length; i++) expect(kept[i]).toBeGreaterThan(kept[i - 1] as number);
    }
    {
      // drops samples outside the visible range and keeps one gap marker per column
      const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const ys = [1, 9, Number.NaN, Number.NaN, 2, 8, 3, 7, 4, 6];
      expect(minMaxBuckets(xs, ys, { buckets: 1, x0: 2, x1: 5 })).toEqual([2, 4, 5]);
      expect(minMaxBuckets(xs, ys, { buckets: 100 })).toHaveLength(10);
      expect(minMaxBuckets([], [], { buckets: 10 })).toEqual([]);
    }
  });
});

describe('bisect', () => {
  const xs = [0, 10, 20, 30];
  it('finds insertion points and nearest samples; works on points and typed arrays', () => {
    // finds insertion points and nearest samples
    expect(bisectLeft(xs, 15)).toBe(2);
    expect(bisectLeft(xs, 20)).toBe(2);
    expect(bisectLeft(xs, 99)).toBe(4);
    expect(bisectX(xs, 14)).toBe(1);
    expect(bisectX(xs, 16)).toBe(2);
    expect(bisectX(xs, 15)).toBe(1);
    expect(bisectX(xs, -5)).toBe(0);
    expect(bisectX(xs, 500)).toBe(3);
    expect(bisectX([], 1)).toBe(-1);
    {
      // works on points and typed arrays
      const points = xs.map((x) => ({ x, y: x }));
      expect(bisectX(points, 26)).toBe(3);
      expect(bisectX(new Float64Array(xs), 26)).toBe(3);
    }
  });
});

describe('threshold', () => {
  it('derives the point budget from the plot width', () => {
    expect(downsampleThreshold(640)).toBe(1280);
  });
});

describe('ordinalScale', () => {
  it('maps domain keys to range values and cycles when short', () => {
    const color = ordinalScale({
      domain: ['a', 'b', 'c'],
      range: ['red', 'blue'],
    });
    expect(color('a')).toBe('red');
    expect(color('b')).toBe('blue');
    expect(color('c')).toBe('red');
    expect(color('missing' as 'a')).toBeUndefined();
  });
});

describe('sunburst', () => {
  const root = {
    id: 'all',
    children: [
      { id: 'a', value: 6 },
      { id: 'b', value: 6 },
      { id: 'c', value: 4 },
      { id: 'd', value: 8 },
    ],
  };
  it('assigns angle spans proportional to value and rings by depth; rejects invalid values like treemap', () => {
    {
      // assigns angle spans proportional to value and rings by depth
      const arcs = sunburst(root, { radius: 100, innerRadius: 20 });
      const total = 24;
      const full = Math.PI * 2;
      expect(arcs[0]).toMatchObject({ id: 'all', depth: 0, parentId: null, value: 24 });
      const leaves = arcs.filter((a) => a.leaf);
      expect(leaves).toHaveLength(4);
      for (const leaf of leaves) {
        expect(leaf.x1 - leaf.x0).toBeCloseTo((leaf.value / total) * full, 10);
        expect(leaf.y0).toBe(20);
        expect(leaf.y1).toBe(100);
      }
      const span = leaves.reduce((s, a) => s + (a.x1 - a.x0), 0);
      expect(span).toBeCloseTo(full, 10);
    }
    // rejects invalid values like treemap
    expect(() => sunburst({ id: 'r', value: 5, children: [{ id: 'a', value: 2 }] }, {})).toThrow(
      TreemapError
    );
  });
});

describe('pack', () => {
  const root = {
    id: 'all',
    children: [
      { id: 'a', value: 4 },
      { id: 'b', value: 1 },
      { id: 'c', value: 1 },
    ],
  };

  it('places non-overlapping circles scaled into the box', () => {
    const circles = pack(root, { width: 200, height: 200, padding: 2 });
    const byId = Object.fromEntries(circles.map((c) => [c.id, c]));
    expect(byId.all?.r).toBeGreaterThan(0);
    expect(byId.a?.r).toBeGreaterThan(byId.b?.r ?? 0);
    // Fit inside the box.
    for (const c of circles) {
      expect(c.x - c.r).toBeGreaterThanOrEqual(-1e-6);
      expect(c.y - c.r).toBeGreaterThanOrEqual(-1e-6);
      expect(c.x + c.r).toBeLessThanOrEqual(200 + 1e-6);
      expect(c.y + c.r).toBeLessThanOrEqual(200 + 1e-6);
    }
    // Siblings do not overlap (allow tiny numeric slack).
    const leaves = circles.filter((c) => c.leaf);
    for (let i = 0; i < leaves.length; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        const a = leaves[i]!;
        const b = leaves[j]!;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        expect(dist + 1e-6).toBeGreaterThanOrEqual(a.r + b.r);
      }
    }
  });
});

describe('fitChartWidth (audit P1-01)', () => {
  // Audit P1-01: charts drew at a fixed 640-unit viewBox, so text shrank with it
  // on phones. They now lay out at their measured width.
  describe('fitChartWidth', () => {
    it('uses the measured width between the minimum and the preferred width, and 2 related cases', () => {
      // uses the measured width between the minimum and the preferred width
      expect(fitChartWidth(288, 640)).toBe(288);
      expect(fitChartWidth(612.4, 640)).toBe(612);
      // keeps the preferred width for wider boxes and when unmeasured
      expect(fitChartWidth(1200, 640)).toBe(640);
      expect(fitChartWidth(0, 640)).toBe(640);
      expect(fitChartWidth(undefined, 640)).toBe(640);
      expect(fitChartWidth(Number.NaN, 640)).toBe(640);
      // never lays out narrower than the minimum (or the preferred width when smaller)
      expect(fitChartWidth(120, 640)).toBe(MIN_CHART_WIDTH);
      expect(fitChartWidth(120, 200)).toBe(200);
    });
  });
});

describe('chart format spec cache (Task 185)', () => {
  /*
   * Declarative chart formats reuse one Intl formatter per spec (Task 185 found
   * a new formatter per value: 100k values took about 8.5 s). The wall-clock
   * limit lives in tests/perf/plan004-surfaces.test.ts (pnpm test:perf).
   */

  describe('chart format spec cache', () => {
    it('formats exactly like a fresh Intl formatter for each spec; falls back for options Intl rejects, every time; keeps working past the cache bound', () => {
      {
        // formats exactly like a fresh Intl formatter for each spec
        const specs: ChartFormatSpec[] = [
          { type: 'number', locale: 'en-US', notation: 'compact' },
          { type: 'number', locale: 'en-US', style: 'currency', currency: 'USD' },
          { type: 'number', locale: 'de-DE', minimumFractionDigits: 2, maximumFractionDigits: 2 },
          { type: 'date', locale: 'en-US', dateStyle: 'medium', timeZone: 'UTC' },
        ];
        const fresh = [
          new Intl.NumberFormat('en-US', { style: 'decimal', notation: 'compact' }),
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'standard',
          }),
          new Intl.NumberFormat('de-DE', {
            style: 'decimal',
            notation: 'standard',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
          new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
        ];
        for (const value of [0, 1234.5, 1_700_000_000_000]) {
          specs.forEach((spec, i) => {
            // Twice: the second call is served from the cache.
            expect(formatChartValue(value, spec)).toBe(fresh[i]?.format(value));
            expect(formatChartValue(value, spec)).toBe(fresh[i]?.format(value));
          });
        }
      }
      {
        // falls back for options Intl rejects, every time
        const bad: ChartFormatSpec = { type: 'number', style: 'currency' };
        expect(formatChartValue(12, bad)).toBe(formatChartValue(12));
        expect(formatChartValue(12, bad)).toBe(formatChartValue(12));
      }
      // keeps working past the cache bound
      for (let i = 0; i <= MAX_CACHED_FORMATTERS * 2; i++) {
        const spec: ChartFormatSpec = { type: 'number', maximumFractionDigits: i % 21 };
        // 1.5 prints as "2" with zero fraction digits and "1.5" otherwise.
        expect(
          formatChartValue(1.5, { ...spec, minimumFractionDigits: 0, locale: 'en-US' })
        ).toMatch(/^(2|1\.5)$/);
      }
    });
  });
});

describe('appendSeriesWindow', () => {
  describe('appendSeriesWindow', () => {
    it('appends immutably and retains only the newest points per series, and 2 related cases', () => {
      {
        // appends immutably and retains only the newest points per series
        const current = [
          {
            id: 'latency',
            label: 'Latency',
            points: [
              { x: 0, y: 12 },
              { x: 1, y: 11 },
              { x: 2, y: 14 },
            ],
          },
        ];
        const additions = [
          {
            id: 'latency',
            label: 'Latency',
            points: [
              { x: 3, y: 10 },
              { x: 4, y: null },
              { x: 5, y: 9 },
            ],
          },
        ];

        const next = appendSeriesWindow(current, additions, { maxPoints: 4 });

        expect(next[0]?.points).toEqual([
          { x: 2, y: 14 },
          { x: 3, y: 10 },
          { x: 4, y: null },
          { x: 5, y: 9 },
        ]);
        expect(current[0]?.points).toHaveLength(3);
        expect(additions[0]?.points).toHaveLength(3);
        expect(next).not.toBe(current);
        expect(next[0]).not.toBe(current[0]);
      }
      {
        // rejects non-append order, unknown or duplicate streams, invalid points, and unsafe bounds
        const current = [{ id: 'latency', label: 'Latency', points: [{ x: 2, y: 3 }] }];
        const batch = (id: string, points: { x: number; y: number | null }[]) => [
          { id, label: 'Latency', points },
        ];

        expect(() => appendSeriesWindow(current, batch('latency', [{ x: 2, y: 4 }]))).toThrow(
          /strictly after/
        );
        expect(() =>
          appendSeriesWindow(
            current,
            batch('latency', [
              { x: 4, y: 4 },
              { x: 3, y: 5 },
            ])
          )
        ).toThrow(/strictly increasing/);
        expect(() => appendSeriesWindow(current, batch('unknown', [{ x: 3, y: 4 }]))).toThrow(
          /unknown series/
        );
        expect(() =>
          appendSeriesWindow(current, [
            ...batch('latency', [{ x: 3, y: 4 }]),
            ...batch('latency', [{ x: 4, y: 5 }]),
          ])
        ).toThrow(/Duplicate appended series/);
        expect(() =>
          appendSeriesWindow(current, batch('latency', [{ x: Number.NaN, y: 4 }]))
        ).toThrow(/finite numeric/);
        expect(() =>
          appendSeriesWindow(current, batch('latency', [{ x: 3, y: Number.POSITIVE_INFINITY }]))
        ).toThrow(/finite numeric/);
        expect(() => appendSeriesWindow(current, [], { maxPoints: 0 })).toThrow(/maxPoints/);
      }
      {
        // bounds an oversized seed even when the incoming batch is empty
        const current = [
          {
            id: 'latency',
            label: 'Latency',
            points: Array.from({ length: 5 }, (_, x) => ({ x, y: x })),
          },
        ];

        const next = appendSeriesWindow(current, [], { maxPoints: 2 });

        expect(next[0]?.points).toEqual([
          { x: 3, y: 3 },
          { x: 4, y: 4 },
        ]);
        expect(current[0]?.points).toHaveLength(5);
      }
    });
  });
});

describe('chart annotations', () => {
  const plot = { x: 10, y: 20, width: 100, height: 80 };

  describe('chart annotations', () => {
    const annotations: ChartAnnotation[] = [
      { id: 'goal', type: 'line', axis: 'y', value: 5, label: 'Goal: 5' },
      { id: 'focus', type: 'band', axis: 'x', start: 'Tue', end: 'Mon', label: 'Focus window' },
      { id: 'event', type: 'point', x: 'Tue', y: 3, label: 'Release event' },
    ];
    it('projects line, normalized band and point annotations into plot space, and 2 related cases', () => {
      {
        // projects line, normalized band and point annotations into plot space
        const projected = projectAnnotations(annotations, {
          plot,
          x: (value) => (value === 'Mon' ? 25 : value === 'Tue' ? 75 : undefined),
          y: (value) => (typeof value === 'number' ? 100 - value * 10 : undefined),
        });
        expect(projected).toEqual([
          { id: 'goal', type: 'line', axis: 'y', position: 50, label: 'Goal: 5' },
          { id: 'focus', type: 'band', axis: 'x', start: 25, end: 75, label: 'Focus window' },
          { id: 'event', type: 'point', x: 75, y: 70, label: 'Release event' },
        ]);
      }
      {
        // adds an announcement point for every annotation in declaration order
        const projected = projectAnnotations(annotations, {
          plot,
          x: (value) => (value === 'Mon' ? 25 : 75),
          y: (value) => (typeof value === 'number' ? 100 - value * 10 : undefined),
        });
        const series = annotationInteractionSeries(projected, plot);
        expect(series[0]?.points.map((point) => point.accessibleLabel)).toEqual([
          'Annotation: Goal: 5.',
          'Annotation: Focus window.',
          'Annotation: Release event.',
        ]);
        expect(series[0]?.points[0]).toMatchObject({ x: 60, y: 50, yValue: null });
        expect(series[0]?.pointer).toBe(false);
        expect(
          nearestPoint2d(
            [
              { id: 'data', label: 'Data', points: [{ x: 60, y: 50, xValue: 'A', yValue: 1 }] },
              ...series,
            ],
            new Set(),
            60,
            50
          )
        ).toEqual({ series: 0, index: 0 });
      }
      // rejects duplicate ids and missing labels
      expect(() => assertChartAnnotations([annotations[0]!, annotations[0]!])).toThrow(
        /Duplicate annotation id/
      );
      expect(() =>
        assertChartAnnotations([{ id: 'unlabeled', type: 'point', x: 1, y: 2, label: ' ' }])
      ).toThrow(/non-empty label/);
      expect(() =>
        assertChartAnnotations(
          Array.from({ length: 101 }, (_, index) => ({
            id: `a${index}`,
            type: 'line' as const,
            axis: 'y' as const,
            value: index,
            label: `Line ${index}`,
          }))
        )
      ).toThrow(/at most 100/);
    });
  });
});

describe('categorical fallbacks (T-adopt-domain)', () => {
  // The one hex set the frame-drawn charts paint when a theme carries no
  // --tx-chart-N (ColorBrewer, per mode). Emitting data-viz tokens for every
  // theme by default moves these pixels, so it waits for a visual review.
  const CANONICAL = {
    light: ['#2166ac', '#b35806', '#1b7837', '#762a83', '#d73027', '#018571', '#5e3c99', '#a6611a'],
    dark: ['#6baed6', '#fd8d3c', '#74c476', '#9e9ac8', '#fb6a4a', '#41b6c4', '#bcbddc', '#fdae6b'],
  };
  const fallbacks = (file: string) => {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    const [light, dark] = source.split(/\[data-mode='dark'\]/u);
    const read = (css = '') =>
      Array.from({ length: 8 }, (_, i) => {
        const match = new RegExp(`var\\(--tx-chart-${i + 1}, (#[0-9a-f]{6})\\)`, 'u').exec(css);
        return match?.[1];
      });
    return { light: read(light), dark: read(dark) };
  };

  it('the cartesian and matrix frames read --tx-chart-N with the same canonical set', () => {
    for (const file of ['cartesian/CartesianChart.svelte', 'matrix/MatrixFrame.svelte']) {
      expect(fallbacks(file), file).toEqual(CANONICAL);
    }
  });
});
