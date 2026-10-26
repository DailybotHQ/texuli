import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BubbleChart from '../src/matrix/BubbleChart.svelte';
import HeatmapChart from '../src/matrix/HeatmapChart.svelte';
import {
  assertHeatmapCells,
  assertScatterPoints,
  createHeatmapLayout,
  createScatterLayout,
  formatMatrixNumber,
  type HeatmapCell,
  heatmapFill,
  type ScatterPoint,
} from '../src/matrix/model.ts';
import ScatterChart from '../src/matrix/ScatterChart.svelte';

afterEach(() => cleanup());

const heatCells: HeatmapCell[] = [
  { x: 'Mon', y: 'Alpha', value: 1 },
  { x: 'Tue', y: 'Alpha', value: 4 },
  { x: 'Mon', y: 'Beta', value: 2 },
  { x: 'Tue', y: 'Beta', value: 8 },
];

const scatterPoints: ScatterPoint[] = [
  { id: 'a', label: 'Ada', x: 1, y: 2, seriesId: 'eng' },
  { id: 'b', label: 'Grace', x: 3, y: 5, seriesId: 'eng' },
  { id: 'c', label: 'Alan', x: 2, y: 4, seriesId: 'ops' },
];

const bubblePoints: ScatterPoint[] = [
  { id: 'p1', label: 'North', x: 10, y: 20, r: 5, seriesId: 'a' },
  { id: 'p2', label: 'South', x: 30, y: 15, r: 12, seriesId: 'b' },
  { id: 'p3', label: 'East', x: 20, y: 40, r: 8, seriesId: 'a' },
];

describe('matrix model', () => {
  it('rejects invalid heatmap and scatter input', () => {
    expect(() => assertHeatmapCells([{ x: '', y: 'A', value: 1 }])).toThrow(/x category/);
    expect(() => assertScatterPoints([{ id: 'x', label: '', x: 1, y: 2 }])).toThrow(/label/);
    expect(() =>
      assertScatterPoints([{ id: 'x', label: 'X', x: 1, y: 2 }], { requireRadius: true })
    ).toThrow(/r/);
  });

  it('builds heatmap layout with normalized colors', () => {
    const layout = createHeatmapLayout(heatCells, 400, 300);
    expect(layout.xKeys).toEqual(['Mon', 'Tue']);
    expect(layout.yKeys).toEqual(['Alpha', 'Beta']);
    expect(layout.cells).toHaveLength(4);
    const max = layout.cells.find((c) => c.value === 8);
    expect(max?.t).toBe(1);
    expect(heatmapFill(0)).toContain('sequential');
    expect(formatMatrixNumber(12.345)).toMatch(/12/);
  });

  it('builds scatter and bubble layouts', () => {
    const scatter = createScatterLayout(scatterPoints, {
      series: [
        { id: 'eng', label: 'Engineering' },
        { id: 'ops', label: 'Operations' },
      ],
    });
    expect(scatter.points).toHaveLength(3);
    expect(scatter.series.map((s) => s.id)).toEqual(['eng', 'ops']);
    const bubble = createScatterLayout(bubblePoints, { bubble: true });
    expect(bubble.points.every((p) => p.radius >= 6 && p.radius <= 28)).toBe(true);
  });
});

describe('HeatmapChart', () => {
  it('renders title, description, cells and a data table', () => {
    render(HeatmapChart, {
      props: {
        title: 'Team load',
        description: 'Relative load by day and team.',
        cells: heatCells,
      },
    });
    expect(screen.getByRole('heading', { name: 'Team load' })).toBeTruthy();
    expect(screen.getByText('Relative load by day and team.')).toBeTruthy();
    const figure = document.querySelector('[data-kind="heatmap"]');
    expect(figure).toBeTruthy();
    expect(figure?.querySelectorAll('rect[data-cell]').length).toBe(4);
    expect(screen.getByText('View data table')).toBeTruthy();
  });

  it('wires shared categorical axes for both matrix dimensions', () => {
    const { container } = render(HeatmapChart, {
      props: {
        title: 'Team load',
        description: 'Relative load by day and team.',
        cells: heatCells,
      },
    });
    expect(container.querySelector('[data-chart-axis="x"]')?.textContent).toContain('Mon');
    expect(container.querySelector('[data-chart-axis="y"]')?.textContent).toContain('Alpha');
  });

  it('renders the grammar-mandated h2 figure title', () => {
    const { container } = render(HeatmapChart, {
      props: {
        title: 'Team load',
        description: 'Relative load by day and team.',
        cells: heatCells,
      },
    });
    expect(container.querySelector('figcaption h2')).toBeTruthy();
    expect(container.querySelector('figcaption h3')).toBeNull();
  });

  it('requires accessible title and description', () => {
    expect(() =>
      render(HeatmapChart, {
        props: { title: '', description: 'x', cells: heatCells },
      })
    ).toThrow(/title/);
  });

  it('loads keyboard exploration only when opted in', async () => {
    const staticView = render(HeatmapChart, {
      props: {
        title: 'Team load',
        description: 'Relative load by day and team.',
        cells: heatCells,
      },
    });
    expect(staticView.container.querySelector('[data-matrix-static-plot]')).toBeTruthy();
    expect(staticView.container.querySelector('[data-chart-explorer]')).toBeNull();
    staticView.unmount();

    render(HeatmapChart, {
      props: {
        title: 'Team load',
        description: 'Relative load by day and team.',
        cells: heatCells,
        interactive: true,
      },
    });
    const explorer = await waitFor(() => {
      const element = document.querySelector('[data-chart-explorer]');
      if (!(element instanceof HTMLElement)) throw new Error('Interaction chunk is pending.');
      return element;
    });
    await fireEvent.focus(explorer);
    expect(document.querySelector('[data-chart-live]')?.textContent).toContain('Alpha, Mon: 1');
    await fireEvent.keyDown(explorer, { key: 'ArrowRight' });
    expect(document.querySelector('[data-chart-live]')?.textContent).toContain('Alpha, Tue: 4');
    await fireEvent.keyDown(explorer, { key: 'PageDown' });
    expect(document.querySelector('[data-chart-live]')?.textContent).toContain('Beta, Tue: 8');
    expect(document.querySelectorAll('[data-crosshair]')).toHaveLength(2);
    expect(document.querySelector('[data-active-point]')).toBeTruthy();
    expect(screen.getByText('View data table')).toBeTruthy();
  });

  it('projects category annotations and exposes them to the opted-in explorer', async () => {
    render(HeatmapChart, {
      props: {
        title: 'Team load',
        description: 'Relative load by day and team.',
        cells: heatCells,
        interactive: true,
        annotations: [{ id: 'review', type: 'line', axis: 'x', value: 'Tue', label: 'Review day' }],
      },
    });
    const explorer = await waitFor(() => {
      const element = document.querySelector('[data-chart-explorer]');
      if (!(element instanceof HTMLElement)) throw new Error('Interaction chunk is pending.');
      return element;
    });
    expect(document.querySelector('[data-annotation="review"]')).toBeTruthy();
    await fireEvent.focus(explorer);
    await fireEvent.keyDown(explorer, { key: 'PageDown' });
    await fireEvent.keyDown(explorer, { key: 'PageDown' });
    await waitFor(() =>
      expect(document.querySelector('[data-chart-live]')?.textContent).toBe(
        'Annotation: Review day.'
      )
    );
  });
});

describe('ScatterChart and BubbleChart', () => {
  it('renders scatter points and multi-series legend', () => {
    render(ScatterChart, {
      props: {
        title: 'Throughput',
        description: 'Requests versus latency for two teams.',
        points: scatterPoints,
        series: [
          { id: 'eng', label: 'Engineering' },
          { id: 'ops', label: 'Operations' },
        ],
      },
    });
    expect(document.querySelectorAll('circle[data-point]').length).toBe(3);
    expect(screen.getByLabelText('Chart series')).toBeTruthy();
  });

  it('toggles scatter series through the shared keyboard-accessible legend', async () => {
    render(ScatterChart, {
      props: {
        title: 'Throughput',
        description: 'Requests versus latency for two teams.',
        points: scatterPoints,
        series: [
          { id: 'eng', label: 'Engineering' },
          { id: 'ops', label: 'Operations' },
        ],
      },
    });
    const engineering = screen.getByRole('button', { name: 'Engineering' });
    expect(engineering.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(engineering);
    expect(engineering.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelectorAll('circle[data-point]')).toHaveLength(1);
    expect(document.querySelector('[data-point="c"]')).toBeTruthy();
    const operations = screen.getByRole('button', { name: 'Operations' });
    await fireEvent.click(operations);
    expect(operations.getAttribute('aria-disabled')).toBe('true');
    expect(document.querySelectorAll('circle[data-point]')).toHaveLength(1);
  });

  it('renders bubble sizes and size column in the table', () => {
    render(BubbleChart, {
      props: {
        title: 'Regions',
        description: 'Population-weighted region map as bubbles.',
        points: bubblePoints,
        series: [
          { id: 'a', label: 'Group A' },
          { id: 'b', label: 'Group B' },
        ],
      },
    });
    expect(document.querySelector('[data-kind="bubble"]')).toBeTruthy();
    expect(document.querySelectorAll('circle[data-point]').length).toBe(3);
    expect(screen.getByText('View data table')).toBeTruthy();
  });

  it('snaps an opted-in scatter tooltip to the nearest point', async () => {
    const layout = createScatterLayout(scatterPoints, {
      series: [
        { id: 'eng', label: 'Engineering' },
        { id: 'ops', label: 'Operations' },
      ],
    });
    render(ScatterChart, {
      props: {
        title: 'Throughput',
        description: 'Requests versus latency for two teams.',
        points: scatterPoints,
        series: [
          { id: 'eng', label: 'Engineering' },
          { id: 'ops', label: 'Operations' },
        ],
        interactive: true,
      },
    });
    const explorer = await waitFor(() => {
      const element = document.querySelector('[data-chart-explorer]');
      if (!(element instanceof HTMLElement)) throw new Error('Interaction chunk is pending.');
      return element;
    });
    const svg = document.querySelector('[data-chart-svg]');
    Object.defineProperty(svg, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }),
    });
    const grace = layout.points.find((point) => point.id === 'b');
    if (!grace) throw new Error('Expected Grace in the scatter layout.');
    await fireEvent.pointerMove(explorer, { clientX: grace.cx + 2, clientY: grace.cy + 2 });
    expect(document.querySelector('[data-chart-tooltip]')?.textContent).toContain('Grace');
    expect(document.querySelectorAll('[data-crosshair]')).toHaveLength(2);
  });
});
