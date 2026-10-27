import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { calendarColorIndex } from '../../src/calendar/model.ts';
import { createCartesianLayout } from '../../src/cartesian/model.ts';
import Sparkline from '../../src/compact/Sparkline.svelte';
import { SPARKLINE_MAX_POINTS, sparklineGeometry } from '../../src/compact/shared.ts';
import { geoColorIndex } from '../../src/geo/model.ts';
import HistogramChart from '../../src/histogram/HistogramChart.svelte';
import { createHistogramLayout } from '../../src/histogram/model.ts';
import { bin, type CalendarCell, funnelLayout, lttbIndices, pie } from '../../src/math/index.ts';
import { MAX_BINS } from '../../src/math/shapes/bin.ts';
import { createHeatmapLayout, createScatterLayout } from '../../src/matrix/model.ts';
import { HOSTILE_LABELS, HOSTILE_VALUES, HUGE_LENGTH, nonFiniteLeaves } from './corpus.ts';

/*
 * Existing chart families against the hostile corpus: finite geometry, or a
 * TypeError naming the bad input. The huge-series, extreme-magnitude and
 * NaN-domain cases began as `it.fails` KNOWN pins and now pass.
 */

afterEach(cleanup);

const sample = (id: string) => {
  const found = HOSTILE_VALUES.find((item) => item.id === id);
  if (!found) throw new Error(`missing corpus sample ${id}`);
  return found.values as (number | null)[];
};
const huge = sample('huge');
const small = HOSTILE_VALUES.filter((item) => item.id !== 'huge' && item.id !== 'extreme');

describe('histogram and bin', () => {
  it('bins every small corpus sample into finite bars, and 7 related cases', () => {
    // bins every small corpus sample into finite bars
    for (const item of small) {
      const layout = createHistogramLayout(item.values as (number | null)[]);
      expect(nonFiniteLeaves(layout), `${item.id} (${item.title})`).toEqual([]);
    }
    cleanup();
    {
      // bins a huge series without overflowing the stack, counting every value
      const bins = bin(huge);
      expect(bins.reduce((sum, item) => sum + item.count, 0)).toBe(HUGE_LENGTH);
    }
    cleanup();
    {
      // lays out a huge series as finite bars
      const layout = createHistogramLayout(huge);
      expect(layout.bars.length).toBeGreaterThan(0);
      expect(nonFiniteLeaves(layout)).toEqual([]);
    }
    cleanup();
    {
      // lays out tens of thousands of explicit thresholds without a spread
      const thresholds = Array.from({ length: 200_000 }, (_, i) => i);
      const layout = createHistogramLayout([0, 199_999.5], { thresholds, domain: [-1, 200_000] });
      expect(layout.maxCount).toBe(1);
    }
    cleanup();
    {
      // puts the largest finite magnitudes in one bin when the span overflows
      const bins = bin(sample('extreme'));
      expect(bins).toEqual([{ x0: -1e308, x1: 1e308, count: 3 }]);
      expect(nonFiniteLeaves(createHistogramLayout(sample('extreme')))).toEqual([]);
    }
    cleanup();
    // caps the requested bin count at MAX_BINS
    expect(bin([0, 1], { count: 1e9 }).length).toBeLessThanOrEqual(MAX_BINS);
    expect(bin([0, 1], { count: Number.NaN }).length).toBeGreaterThan(0);
    expect(bin([0, 1], { count: -5 })).toHaveLength(1);
    cleanup();
    {
      // ignores a domain with a non-finite edge and bins the data extent
      const layout = createHistogramLayout([1, 2], { domain: [Number.NaN, 5] });
      expect(nonFiniteLeaves(layout)).toEqual([]);
      expect(layout.bars.reduce((sum, bar) => sum + bar.count, 0)).toBe(2);
      expect(bin([1, 2], { domain: [0, Number.POSITIVE_INFINITY] })[0]?.x0).toBeGreaterThanOrEqual(
        1
      );
    }
    cleanup();
    {
      // renders hostile title and description as text
      const { container } = render(HistogramChart, {
        title: HOSTILE_LABELS[0] as string,
        description: HOSTILE_LABELS[2] as string,
        values: [1, 2, 3],
      });
      expect(container.querySelector('script, img, [onerror], [onload]')).toBeNull();
      expect(container.textContent).toContain('<script>');
    }
  });
});

describe('color-index helpers', () => {
  const cells = (values: readonly (number | null)[]): CalendarCell[] =>
    values.map((value, i) => ({ date: '2026-01-01', week: i, weekday: 0, value }) as CalendarCell);
  it('calendar and geo scales stay in 0…8 for small hostile inputs, and 2 related cases', () => {
    // calendar and geo scales stay in 0…8 for small hostile inputs
    for (const item of small) {
      const values = (item.values as (number | null)[]).map((value) =>
        typeof value === 'number' && Number.isFinite(value) ? value : null
      );
      const calendar = calendarColorIndex(1, cells(values));
      const geo = geoColorIndex(1, values);
      for (const index of [calendar, geo]) {
        if (index !== null) {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThanOrEqual(8);
        }
      }
    }
    cleanup();
    // calendar and geo scales handle a huge value list
    expect(calendarColorIndex(48, cells(huge))).toBe(4);
    expect(geoColorIndex(96, huge)).toBe(8);
    cleanup();
    {
      // calendar and geo scales stay finite across the largest magnitudes
      const extreme = [-1e308, 0, 1e308];
      expect(calendarColorIndex(0, cells(extreme))).toBe(4);
      expect(geoColorIndex(1e308, extreme)).toBe(8);
      expect(geoColorIndex(Number.NaN, extreme)).toBeNull();
    }
  });
});

describe('funnel, pie and downsampling', () => {
  it('pie turns NaN, negative and infinite slices into empty slices, and 3 related cases', () => {
    {
      // pie turns NaN, negative and infinite slices into empty slices
      const slices = pie([Number.NaN, -5, Number.POSITIVE_INFINITY, 3]);
      expect(nonFiniteLeaves(slices)).toEqual([]);
      expect(slices.map((slice) => slice.value)).toEqual([0, 0, 0, 3]);
    }
    cleanup();
    {
      // funnel clamps non-finite step values to zero
      const steps = [Number.NaN, -1, Number.POSITIVE_INFINITY, 10].map((value, i) => ({
        id: `s${i}`,
        value,
      }));
      expect(nonFiniteLeaves(funnelLayout(steps, { width: 300, height: 200 }))).toEqual([]);
    }
    cleanup();
    {
      // lays out a huge funnel step list without overflowing the stack
      const steps = huge.map((value, i) => ({ id: `s${i}`, value: value ?? 0 }));
      expect(funnelLayout(steps, { width: 300, height: 200 })).toHaveLength(HUGE_LENGTH);
    }
    cleanup();
    {
      // lttbIndices() returns integer indices for NaN coordinates
      const indices = lttbIndices([Number.NaN, 1, 2, 3], [1, Number.NaN, 3, 4], 3);
      expect(indices.every((index) => Number.isInteger(index))).toBe(true);
    }
  }, 20_000);
});

describe('validated families reject hostile input with a TypeError', () => {
  it('cartesian rejects non-finite y, blank ids and duplicate ids, and 2 related cases', () => {
    {
      // cartesian rejects non-finite y, blank ids and duplicate ids
      const bad = [
        [{ id: 'a', label: 'A', points: [{ x: 0, y: Number.NaN }] }],
        [{ id: '', label: 'A', points: [] }],
        [
          { id: 'a', label: 'A', points: [] },
          { id: 'a', label: 'B', points: [] },
        ],
        [{ id: 'a', label: 'A', points: [{ x: Number.POSITIVE_INFINITY, y: 1 }] }],
      ];
      for (const series of bad) expect(() => createCartesianLayout(series)).toThrow(TypeError);
    }
    cleanup();
    {
      // cartesian draws a hostile label series with finite geometry
      const series = HOSTILE_LABELS.map((label, i) => ({
        id: `s${i}`,
        label,
        points: [
          { x: 0, y: i },
          { x: 1, y: -1e300 },
        ],
      }));
      const layout = createCartesianLayout(series);
      const ys = series.flatMap((item) => item.points.map((point) => layout.yPosition(point.y)));
      expect(ys.every(Number.isFinite)).toBe(true);
    }
    cleanup();
    // scatter and heatmap reject non-finite coordinates and values
    expect(() => createScatterLayout([{ id: 'p', label: 'P', x: Number.NaN, y: 1 }], {})).toThrow(
      TypeError
    );
    expect(() => createHeatmapLayout([{ x: 'a', y: 'b', value: Number.NaN }])).toThrow(TypeError);
  });
});

describe('compact family', () => {
  it('Sparkline drops non-finite values and renders hostile labels as text, and 2 related cases', () => {
    {
      // Sparkline drops non-finite values and renders hostile labels as text
      const { container } = render(Sparkline, {
        values: sample('non-finite'),
        label: HOSTILE_LABELS[1] as string,
      });
      expect(container.querySelector('[onload], script')).toBeNull();
      const d = [...container.querySelectorAll('[d]')]
        .map((node) => node.getAttribute('d'))
        .join(' ');
      expect(d).not.toMatch(/NaN|Infinity/);
    }
    cleanup();
    // Sparkline geometry handles a huge series and draws a bounded bucket sample
    for (const variant of ['line', 'area', 'bar'] as const) {
      const geometry = sparklineGeometry(huge, variant, 32);
      expect(geometry.points.length).toBeLessThanOrEqual(SPARKLINE_MAX_POINTS + 1);
      expect(geometry.points[geometry.last]?.index).toBe(HUGE_LENGTH - 1);
      expect(geometry.line).not.toMatch(/NaN|Infinity/);
    }
    cleanup();
    {
      // Sparkline renders a huge series with bounded marks and a windowed table
      const { container } = render(Sparkline, { values: huge, label: 'Huge', variant: 'bar' });
      expect(container.querySelectorAll('rect').length).toBeLessThanOrEqual(
        SPARKLINE_MAX_POINTS + 1
      );
      const table = container.querySelector('table');
      expect(table?.getAttribute('aria-rowcount')).toBe(String(HUGE_LENGTH + 1));
      expect(container.querySelectorAll('tbody tr:not(.spacer)').length).toBeLessThan(50);
    }
  }, 20_000);
});
