import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChartTable from '../src/interaction/ChartTable.svelte';
import InteractivePlot from '../src/interaction/InteractivePlot.svelte';
import Legend from '../src/interaction/Legend.svelte';
import {
  brushToDomain,
  type ChartFormatters,
  clampZoomDomain,
  nearestIndex,
  nearestPoint2d,
  normalizeBrush,
  type PlotSeries,
  stepIndex,
  stepSeries,
  tableRows,
  tableWindow,
  toggleSeries,
  tooltipPosition,
  zoomDomain,
} from '../src/interaction/model.ts';
import TableToggle from '../src/interaction/TableToggle.svelte';

afterEach(cleanup);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu'];
const series: PlotSeries<{ id: string }>[] = [
  {
    id: 'signups',
    label: 'Signups',
    points: [10, 20, null, 40].map((v, i) => ({
      x: 50 + i * 100,
      y: v === null ? null : 200 - v,
      xValue: i,
      yValue: v,
      datum: { id: `s${i}` },
    })),
  },
  {
    id: 'trials',
    label: 'Trials',
    points: [5, 8, 12, 16].map((v, i) => ({
      x: 50 + i * 100,
      y: 200 - v * 2,
      xValue: i,
      yValue: v,
      datum: { id: `t${i}` },
    })),
  },
];
const formatters: ChartFormatters = {
  x: (v) => DAYS[Number(v)] ?? String(v),
  y: (v) => (v === null ? '—' : `${v} users`),
};
const plot = { x: 40, y: 10, width: 400, height: 180 };
const marks = createRawSnippet(() => ({ render: () => '<g data-testid="marks"></g>' }));

describe('interaction model', () => {
  it('steps over gaps and finds the nearest defined point, and 7 related cases', () => {
    {
      // steps over gaps and finds the nearest defined point
      const points = series[0]?.points ?? [];
      expect(stepIndex(points, 1, 1)).toBe(3);
      expect(stepIndex(points, 3, 1)).toBe(3);
      expect(stepIndex(points, 3, -1)).toBe(1);
      expect(nearestIndex(points, 240)).toBe(1);
      expect(nearestIndex(points, 290)).toBe(3);
      expect(nearestIndex([], 10)).toBe(-1);
    }
    cleanup();
    // moves across visible series only
    expect(stepSeries(series, new Set(), { series: 0, index: 1 }, 1)).toEqual({
      series: 1,
      index: 1,
    });
    expect(stepSeries(series, new Set(['trials']), { series: 0, index: 1 }, 1)).toEqual({
      series: 0,
      index: 1,
    });
    expect(stepSeries(series, new Set(), { series: 1, index: 2 }, -1)).toEqual({
      series: 0,
      index: 1,
    });
    cleanup();
    // finds the nearest visible point in two dimensions
    expect(nearestPoint2d(series, new Set(), 252, 176)).toEqual({ series: 1, index: 2 });
    expect(nearestPoint2d(series, new Set(['trials']), 252, 176)).toEqual({
      series: 0,
      index: 3,
    });
    expect(nearestPoint2d(series, new Set(), Number.NaN, 0)).toBeNull();
    cleanup();
    {
      // never hides the last visible series
      const ids = ['a', 'b'];
      expect([...toggleSeries(new Set(), 'a', ids)]).toEqual(['a']);
      expect([...toggleSeries(new Set(['a']), 'b', ids)]).toEqual(['a']);
      expect([...toggleSeries(new Set(['a']), 'a', ids)]).toEqual([]);
    }
    cleanup();
    {
      // places the tooltip inside the frame, flipping at edges, never over the point
      const size = { width: 100, height: 40 };
      const bounds = { width: 400, height: 200 };
      expect(tooltipPosition({ x: 50, y: 100 }, size, bounds)).toEqual({ left: 62, top: 48 });
      expect(tooltipPosition({ x: 380, y: 100 }, size, bounds)).toEqual({ left: 268, top: 48 });
      expect(tooltipPosition({ x: 50, y: 10 }, size, bounds)).toEqual({ left: 62, top: 22 });
      for (const anchor of [
        { x: 395, y: 5 },
        { x: 5, y: 195 },
        { x: 200, y: 100 },
      ]) {
        const box = tooltipPosition(anchor, size, bounds);
        const covers =
          anchor.x >= box.left &&
          anchor.x <= box.left + 100 &&
          anchor.y >= box.top &&
          anchor.y <= box.top + 40;
        expect(covers, JSON.stringify(anchor)).toBe(false);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top + 40).toBeLessThanOrEqual(200);
      }
    }
    cleanup();
    {
      // builds table rows over every x
      const rows = tableRows(series);
      expect(rows).toHaveLength(4);
      expect(rows[2]).toEqual({ xValue: 2, cells: [null, 12] });
    }
    cleanup();
    {
      // bounds the rendered table window for a 100k-point series
      const initial = tableWindow(100_000, 0, 320);
      expect(initial.start).toBe(0);
      expect(initial.end).toBeLessThan(20);
      expect(initial.bottom).toBeGreaterThan(3_000_000);

      const middle = tableWindow(100_000, 1_600_000, 320);
      expect(middle.start).toBeLessThan(50_000);
      expect(middle.end).toBeGreaterThan(50_000);
      expect(middle.end - middle.start).toBeLessThan(20);
      expect(middle.top + (middle.end - middle.start) * 32 + middle.bottom).toBe(3_200_000);
    }
    cleanup();
    {
      // normalizes brush, maps to domain, clamps and zooms
      expect(normalizeBrush(80, 20)).toEqual({ start: 20, end: 80 });
      expect(brushToDomain({ start: 0, end: 100 }, (p) => p / 10)).toEqual([0, 10]);
      expect(clampZoomDomain([8, 12], [0, 10], 2)).toEqual([8, 10]);
      const zoomed = zoomDomain([0, 10], 0.5, 5, [0, 10]);
      expect(zoomed[1] - zoomed[0]).toBeCloseTo(5);
      expect(zoomed[0]).toBeGreaterThanOrEqual(0);
      expect(zoomed[1]).toBeLessThanOrEqual(10);
    }
  });
});

describe('InteractivePlot', () => {
  const setup = (props: Record<string, unknown> = {}) =>
    render(InteractivePlot, {
      label: 'Signups and trials',
      series,
      width: 480,
      height: 220,
      plot,
      formatters,
      children: marks,
      ...props,
    });
  const live = () => document.querySelector('[data-chart-live]')?.textContent;
  /** Named graphics region (static role=img). */
  const graphic = () => screen.getByRole('img', { name: /^Signups and trials/ });
  /** Keyboard explorer (role=application). */
  const explorer = () => screen.getByRole('application', { name: /^Signups and trials/ });
  it('keeps a named img graphic and a separate keyboard explorer, and 4 related cases', async () => {
    // keeps a named img graphic and a separate keyboard explorer
    await (async () => {
      setup();
      const img = graphic();
      expect(img.getAttribute('role')).toBe('img');
      expect(img.getAttribute('tabindex')).toBeNull();
      expect(img.hasAttribute('aria-activedescendant')).toBe(false);
      expect(screen.getByTestId('marks')).toBeTruthy();

      const app = explorer();
      expect(app.getAttribute('role')).toBe('application');
      expect(app.getAttribute('aria-roledescription')).toBe('chart');
      expect(app.getAttribute('tabindex')).toBe('0');
      await fireEvent.focus(app);
      expect(live()).toBe('Signups, Mon: 10 users. Point 1 of 3.');
      const id = app.getAttribute('aria-activedescendant');
      expect(id && document.getElementById(id)?.textContent).toContain(
        'Signups, Mon: 10 users. Point 1 of 3.'
      );
      expect(document.querySelector('[data-active-point]')?.getAttribute('aria-hidden')).toBe(
        'true'
      );
    })();
    cleanup();
    // moves with arrows, Home and End (skipping gaps) and across series with Page keys
    await (async () => {
      setup();
      const app = explorer();
      await fireEvent.focus(app);
      await fireEvent.keyDown(app, { key: 'ArrowRight' });
      expect(live()).toBe('Signups, Tue: 20 users. Point 2 of 3.');
      await fireEvent.keyDown(app, { key: 'ArrowRight' });
      expect(live()).toBe('Signups, Thu: 40 users. Point 3 of 3.');
      await fireEvent.keyDown(app, { key: 'Home' });
      expect(live()).toContain('Mon: 10 users');
      await fireEvent.keyDown(app, { key: 'End' });
      await fireEvent.keyDown(app, { key: 'PageDown' });
      expect(live()).toBe('Trials, Thu: 16 users. Point 4 of 4.');
      await fireEvent.keyDown(app, { key: 'PageUp' });
      expect(live()).toBe('Signups, Thu: 40 users. Point 3 of 3.');
      const tip = document.querySelector('[data-chart-tooltip]') as HTMLElement;
      expect(tip.textContent).toContain('Thu');
      expect(tip.textContent).toContain('40 users');
      expect(tip.textContent).toContain('16 users');
      expect(document.querySelector('[data-crosshair]')).toBeTruthy();
      await fireEvent.keyDown(app, { key: 'Escape' });
      expect(document.querySelector('[data-chart-tooltip]')).toBeNull();
    })();
    cleanup();
    // renders the shared two-axis layer without adding a tooltip role
    await (async () => {
      setup({ crosshair: 'xy' });
      const app = explorer();
      await fireEvent.focus(app);
      expect(document.querySelectorAll('[data-crosshair]')).toHaveLength(2);
      expect(document.querySelector('[data-crosshair="x"]')).toBeTruthy();
      expect(document.querySelector('[data-crosshair="y"]')).toBeTruthy();
      expect(document.querySelector('[data-tooltip-crosshair-layer]')).toBeTruthy();
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
    })();
    cleanup();
    // skips hidden series and selects with Enter for drill-down
    await (async () => {
      const onselect = vi.fn();
      setup({ hidden: new Set(['signups']), onselect });
      const app = explorer();
      await fireEvent.focus(app);
      expect(live()).toBe('Trials, Mon: 5 users. Point 1 of 4.');
      await fireEvent.keyDown(app, { key: 'PageUp' });
      expect(live()).toContain('Trials');
      await fireEvent.keyDown(app, { key: 'ArrowRight' });
      await fireEvent.keyDown(app, { key: 'Enter' });
      expect(onselect).toHaveBeenCalledTimes(1);
      const selection = onselect.mock.calls[0]?.[0];
      expect(selection.series.id).toBe('trials');
      expect(selection.index).toBe(1);
      expect(selection.datum).toEqual({ id: 't1' });
    })();
    cleanup();
    // follows the pointer to the nearest point and selects on click
    await (async () => {
      const onselect = vi.fn();
      setup({ onselect });
      const app = explorer();
      // happy-dom may not set getBoundingClientRect; stub it.
      Object.defineProperty(app, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 480, height: 220, right: 480, bottom: 220 }),
      });
      const svg = document.querySelector('[data-chart-svg]');
      if (svg) {
        Object.defineProperty(svg, 'getBoundingClientRect', {
          value: () => ({ left: 0, top: 0, width: 480, height: 220, right: 480, bottom: 220 }),
        });
      }
      await fireEvent.focus(app);
      await fireEvent.pointerMove(app, { clientX: 148, clientY: 185 });
      const tip = document.querySelector('[data-chart-tooltip]') as HTMLElement;
      expect(tip?.textContent).toContain('Tue');
      expect(tip?.getAttribute('aria-hidden')).toBe('true');
      expect(document.querySelector('[data-active-point]')?.getAttribute('cx')).toBe('50');
      await fireEvent.click(app, { clientX: 148, clientY: 185 });
      expect(onselect).toHaveBeenCalled();
      // Click focuses the explorer; tooltip stays while keyboard focus remains.
      expect(document.querySelector('[data-chart-tooltip]')).toBeTruthy();
      await fireEvent.blur(app);
      await fireEvent.pointerLeave(app);
      expect(document.querySelector('[data-chart-tooltip]')).toBeNull();
    })();
  });
});

describe('Legend and table chrome', () => {
  it('toggles series via the legend without hiding the last one, and 3 related cases', async () => {
    // toggles series via the legend without hiding the last one
    await (async () => {
      const onchange = vi.fn();
      const view = render(Legend, {
        props: {
          items: [
            { id: 'a', label: 'A', color: 'red' },
            { id: 'b', label: 'B', color: 'blue' },
          ],
          hidden: new Set<string>(),
          onchange,
        },
      });
      await fireEvent.click(view.getByRole('button', { name: 'A' }));
      const next = onchange.mock.calls[0]?.[0] as Set<string> | undefined;
      expect(next ? [...next] : []).toEqual(['a']);
    })();
    cleanup();
    // maps legend marks to their supplied symbol and exposes native keyboard controls
    await (async () => {
      const view = render(Legend, {
        props: {
          items: [{ id: 'trend', label: 'Trend', color: 'red', symbol: 'line' }],
          hidden: new Set<string>(),
          onchange: vi.fn(),
        },
      });
      const button = view.getByRole('button', { name: 'Trend' });
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(button.tabIndex).toBe(0);
      expect(view.container.querySelector('.tx-chart-legend__symbol path')?.getAttribute('d')).toBe(
        'M1 6H11'
      );
    })();
    cleanup();
    // renders a data table and toggle
    await (async () => {
      const table = render(ChartTable, {
        props: { series, formatters, caption: 'Signups table' },
      });
      expect(table.getByText('Signups table')).toBeTruthy();
      expect(table.getByRole('columnheader', { name: 'Signups' })).toBeTruthy();
      table.unmount();

      const toggle = render(TableToggle, { props: { open: false } });
      const btn = toggle.getByRole('button');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      await fireEvent.click(btn);
      expect(btn.getAttribute('aria-expanded')).toBe('true');
    })();
    cleanup();
    // renders a bounded, scrollable row window for large series
    await (async () => {
      const largeSeries: PlotSeries[] = [
        {
          id: 'large',
          label: 'Large series',
          points: Array.from({ length: 2_000 }, (_, i) => ({ x: i, y: i, xValue: i, yValue: i })),
        },
      ];
      const result = render(ChartTable, {
        props: { series: largeSeries, formatters, caption: 'Large data' },
      });
      const table = result.getByRole('table', { name: 'Large data' });
      expect(table.getAttribute('aria-rowcount')).toBe('2001');
      expect(table.querySelectorAll('tbody tr:not(.tx-chart-table__spacer)').length).toBeLessThan(
        20
      );
      const viewport = result.container.querySelector('.tx-chart-table-viewport') as HTMLElement;
      Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 320 });
      viewport.scrollTop = 32 * 1_000;
      await fireEvent.scroll(viewport);
      expect(table.querySelector('tr[aria-rowindex="1002"]')).toBeTruthy();
      expect(table.querySelectorAll('tbody tr:not(.tx-chart-table__spacer)').length).toBeLessThan(
        20
      );
    })();
  });
});
