import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BoxPlotChart from '../src/statistical/BoxPlotChart.svelte';
import EcdfChart from '../src/statistical/EcdfChart.svelte';
import {
  createBoxLayout,
  createEcdfLayout,
  createViolinLayout,
  ecdfQuantileRows,
  MAX_DRAWN_OUTLIERS,
  MAX_STAT_GROUPS,
} from '../src/statistical/model.ts';
import {
  boxSummary,
  ecdf,
  finiteSample,
  kernelDensity,
  MAX_STAT_VALUES,
  quantileSorted,
  silvermanBandwidth,
} from '../src/statistical/stats.ts';
import ViolinChart from '../src/statistical/ViolinChart.svelte';

afterEach(cleanup);

const latency = [
  { id: 'api', label: 'API', values: [1, 2, 3, 4, 5, 6, 7, 8, 100] },
  { id: 'web', label: 'Web', values: [4, 5, 5, 6, 6, 6, 7, 7, 8] },
];

describe('statistical summaries', () => {
  it('interpolates quantiles linearly (R-7) and returns NaN for no values', () => {
    expect(quantileSorted([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4], 1)).toBe(4);
    expect(quantileSorted([7], 0.9)).toBe(7);
    expect(quantileSorted([], 0.5)).toBeNaN();
  });

  it('keeps finite numbers only, sorted, and counts what it dropped', () => {
    expect(finiteSample([3, null, Number.NaN, 1, Number.POSITIVE_INFINITY, 2])).toEqual({
      sorted: [1, 2, 3],
      dropped: 3,
    });
  });

  it('computes a Tukey box summary with whiskers inside the fences', () => {
    const summary = boxSummary([1, 2, 3, 4, 5, 6, 7, 8, 100]);
    expect(summary).toMatchObject({
      count: 9,
      min: 1,
      q1: 3,
      median: 5,
      q3: 7,
      max: 100,
      lowerWhisker: 1,
      upperWhisker: 8,
      outliers: [100],
    });
    expect(boxSummary([1, 2, 3, 100], { whisker: Number.POSITIVE_INFINITY })?.outliers).toEqual([]);
    expect(boxSummary([null, Number.NaN])).toBeNull();
  });

  it('estimates a density that integrates to about one', () => {
    const values = [2, 3, 3, 4, 4, 4, 5, 5, 6];
    const curve = kernelDensity(values, { points: 256 });
    expect(curve).toHaveLength(256);
    const first = curve[0];
    const second = curve[1];
    if (!first || !second) throw new Error('missing density points');
    const step = second.x - first.x;
    const area = curve.reduce((sum, point) => sum + point.density * step, 0);
    expect(area).toBeGreaterThan(0.97);
    expect(area).toBeLessThan(1.03);
    const peak = curve.reduce((best, point) => (point.density > best.density ? point : best));
    expect(Math.abs(peak.x - 4)).toBeLessThan(0.5);
    expect(silvermanBandwidth([5])).toBe(0);
    expect(kernelDensity([5, 5, 5]).every((point) => Number.isFinite(point.density))).toBe(true);
  });

  it('builds an ECDF with one step per distinct value', () => {
    expect(ecdf([3, 1, 2, 2])).toEqual([
      { x: 1, p: 0.25, count: 1 },
      { x: 2, p: 0.75, count: 3 },
      { x: 3, p: 1, count: 4 },
    ]);
    expect(ecdf([])).toEqual([]);
  });
});

describe('statistical layouts', () => {
  it('places boxes on a shared value axis with the median between the quartiles', () => {
    const layout = createBoxLayout(latency, { width: 400, height: 240 });
    expect(layout.marks.map((mark) => mark.id)).toEqual(['api', 'web']);
    for (const mark of layout.marks) {
      // SVG y grows downward: q3 sits above the median, which sits above q1.
      expect(mark.q3).toBeLessThanOrEqual(mark.median);
      expect(mark.median).toBeLessThanOrEqual(mark.q1);
      expect(mark.upperWhisker).toBeLessThanOrEqual(mark.q3);
    }
    expect(layout.marks[0]?.outliers.map((item) => item.value)).toEqual([100]);
    expect(layout.ticks.length).toBeGreaterThan(1);
  });

  it('keeps empty groups for the table and drops duplicate ids', () => {
    const layout = createBoxLayout([
      ...latency,
      { id: 'api', label: 'Duplicate', values: [9] },
      { id: 'idle', label: 'Idle', values: [null] },
    ]);
    expect(layout.marks.map((mark) => mark.label)).toEqual(['API', 'Web']);
    expect(layout.empty).toEqual([{ id: 'idle', label: 'Idle' }]);
  });

  it('caps groups and drawn outliers', () => {
    const many = Array.from({ length: MAX_STAT_GROUPS + 10 }, (_, i) => ({
      id: `g${i}`,
      label: `Group ${i}`,
      values: [i, i + 1, i + 2],
    }));
    expect(createBoxLayout(many).marks).toHaveLength(MAX_STAT_GROUPS);
    const wide = Array.from({ length: 2000 }, (_, i) => (i < 1000 ? 0 : 10 ** (i % 7)));
    const layout = createBoxLayout([{ id: 'w', label: 'Wide', values: wide }]);
    const mark = layout.marks[0];
    expect(mark?.summary.outliers.length).toBeGreaterThan(MAX_DRAWN_OUTLIERS);
    expect(mark?.outliers.length).toBe(MAX_DRAWN_OUTLIERS);
  });

  it('draws closed violin outlines scaled to one shared density', () => {
    const layout = createViolinLayout(latency, { width: 400, height: 240 });
    expect(layout.marks).toHaveLength(2);
    for (const mark of layout.marks) {
      expect(mark.path).toMatch(/^M[\d.,L-]+Z$/);
      expect(mark.density.length).toBeGreaterThan(2);
    }
  });

  it('draws ECDF steps from the plot floor to the top and summarizes quartiles', () => {
    const layout = createEcdfLayout(latency, { width: 400, height: 240 });
    const mark = layout.marks[0];
    if (!mark) throw new Error('missing ECDF mark');
    expect(mark.path.startsWith(`M${layout.plot.left},${layout.plot.bottom}`)).toBe(true);
    expect(mark.path).toContain(`V${layout.plot.top}`);
    expect(ecdfQuantileRows(mark)).toEqual([
      { share: 0.25, value: 3 },
      { share: 0.5, value: 5 },
      { share: 0.75, value: 7 },
      { share: 1, value: 100 },
    ]);
    expect(layout.shareTicks.map((tick) => tick.value)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });

  it('reads at most MAX_STAT_VALUES inputs', () => {
    const huge = Array.from({ length: MAX_STAT_VALUES + 5 }, (_, i) => i);
    const sample = finiteSample(huge);
    expect(sample.sorted).toHaveLength(MAX_STAT_VALUES);
    expect(sample.dropped).toBe(5);
  });
});

describe('statistical components', () => {
  it('renders an accessible box plot with a quartile table', async () => {
    const { container } = render(BoxPlotChart, {
      title: 'Request latency',
      description: 'Latency quartiles per service, in milliseconds.',
      groups: latency,
    });
    expect(screen.getByRole('img', { name: /Request latency/ })).toBeTruthy();
    expect(container.querySelectorAll('[data-group]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-outlier]')).toHaveLength(1);
    await fireEvent.click(screen.getByText('View data table'));
    expect(container.querySelector('thead')?.textContent).toContain('Median');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('renders violins and an ECDF with their tables', () => {
    const violin = render(ViolinChart, {
      title: 'Latency density',
      description: 'Kernel density of latency per service.',
      groups: latency,
    });
    expect(violin.container.querySelectorAll('path.violin')).toHaveLength(2);
    cleanup();
    const chart = render(EcdfChart, {
      title: 'Latency ECDF',
      description: 'Share of requests at or below each latency.',
      series: latency,
    });
    expect(chart.container.querySelectorAll('[data-series]')).toHaveLength(2);
    expect(chart.container.querySelectorAll('.legend li')).toHaveLength(2);
    expect(chart.container.querySelectorAll('tbody tr')).toHaveLength(8);
  });

  it('requires accessible chart text', () => {
    expect(() =>
      render(BoxPlotChart, { title: '', description: 'Quartiles.', groups: latency })
    ).toThrow(/non-empty title/);
    expect(() =>
      render(ViolinChart, { title: 'Density', description: ' ', groups: latency })
    ).toThrow(/accessible description/);
    expect(() => render(EcdfChart, { title: '', description: 'ECDF.', series: latency })).toThrow(
      /non-empty title/
    );
  });
});
