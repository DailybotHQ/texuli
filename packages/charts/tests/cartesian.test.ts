import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { compile } from 'svelte/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Axis from '../src/axis/Axis.svelte';
import {
  type AxisFormatter,
  formatAxisValue,
  formatNumericAxisTick,
  formatTimeAxisTick,
} from '../src/axis/model.ts';
import AreaChart from '../src/cartesian/AreaChart.svelte';
import BarChart from '../src/cartesian/BarChart.svelte';
import CartesianChart from '../src/cartesian/CartesianChart.svelte';
import ComboChart from '../src/cartesian/ComboChart.svelte';
import LineChart from '../src/cartesian/LineChart.svelte';
import {
  assertCartesianSeries,
  type CartesianSeries,
  createCartesianLayout,
  lineCoordinates,
  windowCartesianSeries,
} from '../src/cartesian/model.ts';
import StackedBarChart from '../src/cartesian/StackedBarChart.svelte';
import { bandScale } from '../src/math/index.ts';
import { appendCartesianSeriesWindow } from '../src/streaming/index.ts';

afterEach(cleanup);

describe('Cartesian chart theme contract', () => {
  it('uses the current foreground tokens for chart and caption text', () => {
    const source = readFileSync(
      resolve(__dirname, '../src/cartesian/CartesianChart.svelte'),
      'utf8'
    );
    const css = compile(source, {
      filename: 'CartesianChart.svelte',
      css: 'external',
    }).css?.code;

    expect(css).toMatch(/var\(--tx-foreground,\s*CanvasText\)/);
    expect(css).toMatch(/var\(--tx-muted-foreground,\s*#575757\)/);
    expect(css).not.toContain('--tx-color-text');
  });
});

async function waitForInteractiveChart(name: string | RegExp) {
  return waitFor(() => {
    // Prefer the interactive plot SVG, not the pending placeholder.
    const el = screen.getByRole('img', { name });
    if (el.hasAttribute('data-chart-pending')) {
      throw new Error('interaction chunk still loading');
    }
    return el;
  });
}

const series: CartesianSeries[] = [
  {
    id: 'signups',
    label: 'Signups',
    points: [
      { x: 'Mon', y: 2 },
      { x: 'Tue', y: 5 },
      { x: 'Wed', y: null },
    ],
  },
  {
    id: 'trials',
    label: 'Trials',
    points: [
      { x: 'Mon', y: 1 },
      { x: 'Tue', y: 3 },
      { x: 'Wed', y: 4 },
    ],
  },
];

describe('Cartesian chart data contract', () => {
  it('rejects duplicate identifiers and mixed x types before producing geometry, and 4 related cases', () => {
    // rejects duplicate identifiers and mixed x types before producing geometry
    expect(() =>
      assertCartesianSeries([series[0] as CartesianSeries, series[0] as CartesianSeries])
    ).toThrow(/Duplicate series id/);
    expect(() =>
      assertCartesianSeries([
        {
          id: 'mixed',
          label: 'Mixed',
          points: [
            { x: 'Mon', y: 1 },
            { x: 2, y: 3 },
          ],
        },
      ])
    ).toThrow(/mix category and numeric/);
    cleanup();
    {
      // keeps null gaps in line paths and positions categories in stable order
      const layout = createCartesianLayout([series[0] as CartesianSeries]);
      expect(layout.xKeys).toEqual(['Mon', 'Tue', 'Wed']);
      expect(lineCoordinates(layout, 0).line.match(/M/g)).toHaveLength(1);
      expect(lineCoordinates(layout, 0).line).not.toContain('NaN');
    }
    cleanup();
    {
      // stacks positive values to the cumulative top and keeps negative values below zero
      const layout = createCartesianLayout(
        [
          {
            id: 'a',
            label: 'A',
            points: [
              { x: 0, y: 4 },
              { x: 1, y: -2 },
            ],
          },
          {
            id: 'b',
            label: 'B',
            points: [
              { x: 0, y: 3 },
              { x: 1, y: -5 },
            ],
          },
        ],
        640,
        320,
        true
      );
      expect(layout.stacked[1]?.[0]).toEqual([4, 7]);
      expect(layout.stacked[1]?.[1]).toEqual([-7, -2]);
    }
    cleanup();
    {
      // windows numeric series with boundary neighbors and validates domains
      const [windowed] = windowCartesianSeries(
        [
          {
            id: 'large',
            label: 'Large',
            points: [
              { x: 4, y: 4 },
              { x: 1, y: 1 },
              { x: 3, y: 3 },
              { x: 2, y: 2 },
              { x: 5, y: 5 },
            ],
          },
        ],
        [2, 4]
      );
      expect(windowed?.points.map((point) => point.x)).toEqual([1, 2, 3, 4, 5]);

      const [between] = windowCartesianSeries(
        [
          {
            id: 'gap',
            label: 'Gap',
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
          },
        ],
        [4, 6]
      );
      expect(between?.points.map((point) => point.x)).toEqual([0, 10]);
      expect(() => windowCartesianSeries([], [2, 1])).toThrow(/ascending bounds/);
      expect(() =>
        windowCartesianSeries(
          [{ id: 'categories', label: 'Categories', points: [{ x: 'Mon', y: 1 }] }],
          [0, 1]
        )
      ).toThrow(/requires numeric x values/);
    }
    cleanup();
    {
      // appends a bounded numeric batch without mutating the input series
      const current: CartesianSeries[] = [
        {
          id: 'cpu',
          label: 'CPU',
          color: 'teal',
          points: [
            { x: 0, y: 20 },
            { x: 1, y: 30 },
            { x: 2, y: 25 },
          ],
        },
      ];
      const next = appendCartesianSeriesWindow(
        current,
        [
          {
            seriesId: 'cpu',
            points: [
              { x: 3, y: 35 },
              { x: 4, y: 28 },
              { x: 5, y: 22 },
            ],
          },
        ],
        { maxPoints: 4 }
      );

      expect(next[0]?.points.map((point) => point.x)).toEqual([2, 3, 4, 5]);
      expect(next[0]?.color).toBe('teal');
      expect(current[0]?.points.map((point) => point.x)).toEqual([0, 1, 2]);

      render(LineChart, {
        title: 'CPU over time',
        description: 'CPU utilization from the retained stream window.',
        series: next,
        renderer: 'svg',
        interactive: false,
      });
      expect(
        document.querySelector('[data-line="cpu"]')?.getAttribute('d')?.match(/L/g)
      ).toHaveLength(3);
      expect(document.querySelector('[data-chart-axis="x"]')?.textContent).toContain('5');
      expect(document.querySelector('[data-chart-axis="x"]')?.textContent).not.toContain('0');
    }
  });
});

describe('Cartesian chart renderers', () => {
  const variants = [
    ['line', LineChart],
    ['area', AreaChart],
    ['bar', BarChart],
    ['stacked bar', StackedBarChart],
    ['combo', ComboChart],
  ] as const;
  it('wires shared axes with categorical and deterministic numeric tick labels, and 11 related cases', async () => {
    {
      // wires shared axes with categorical and deterministic numeric tick labels
      const { container } = render(LineChart, {
        title: 'Weekly signups',
        description: 'Signups by day.',
        series: [series[0] as CartesianSeries],
        interactive: false,
      });
      expect(container.querySelector('[data-chart-axis="x"]')?.textContent).toContain('Mon');
      expect(container.querySelector('[data-chart-axis="y"]')?.textContent).toContain('2');
      expect(container.querySelectorAll('[data-chart-axis]')).toHaveLength(2);
    }
    cleanup();
    // renders only the visible numeric window plus boundary points
    for (const [_name, Component] of variants) {
      const points = Array.from({ length: 100 }, (_, x) => ({ x, y: x % 7 }));
      render(Component, {
        title: 'Windowed observations',
        description: 'A focused x-domain window of a larger series.',
        series: [{ id: 'observations', label: 'Observations', points }],
        visibleDomain: [40, 59],
        renderer: 'svg',
        interactive: false,
      });

      const path = document.querySelector('[data-line="observations"]');
      const renderedSegments = path?.getAttribute('d')?.match(/L/g)?.length ?? 0;
      const renderedBars = document.querySelectorAll('rect[data-series="observations"]').length;
      expect(renderedSegments + renderedBars, String(_name)).toBeLessThanOrEqual(24);
      const xAxisLabels = [
        ...(document.querySelector('[data-chart-axis="x"]')?.querySelectorAll('text') ?? []),
      ].map((tick) => tick.textContent);
      expect(xAxisLabels, String(_name)).toContain('40');
      expect(xAxisLabels, String(_name)).toContain('59');
      expect(xAxisLabels, String(_name)).not.toContain('0');
      expect(xAxisLabels, String(_name)).not.toContain('99');

      cleanup();
    }
    cleanup();
    // renders with an accessible description, legend toggles and table fallback
    await (async () => {
      for (const [_kind, Component] of variants) {
        render(Component, {
          title: 'Weekly signups',
          description: 'Signups and trials by day.',
          series,
          mode: 'dark',
        });
        expect(screen.getByRole('figure', { name: 'Weekly signups' }), String(_kind)).toBeTruthy();
        expect(screen.getByText('Signups and trials by day.'), String(_kind)).toBeTruthy();
        const chart = await waitForInteractiveChart(/Weekly signups/);
        expect(chart.getAttribute('role'), String(_kind)).toBe('img');
        expect(chart.hasAttribute('aria-activedescendant'), String(_kind)).toBe(false);
        expect(
          screen
            .getByRole('application', { name: /Weekly signups/ })
            .getAttribute('aria-roledescription'),
          String(_kind)
        ).toBe('chart');
        expect(
          screen.getByRole('list', { name: 'Weekly signups series' }).textContent,
          String(_kind)
        ).toContain('Signups');
        const legend = screen.getByRole('list', { name: 'Weekly signups series' });
        expect(legend.querySelectorAll('.tx-chart-legend__symbol'), String(_kind)).toHaveLength(2);
        if (_kind === 'combo') {
          expect(legend.querySelector('rect')?.getAttribute('fill'), String(_kind)).toContain(
            '--chart-1'
          );
          expect(legend.querySelector('path')?.getAttribute('d'), String(_kind)).toBe('M1 6H11');
        }
        await fireEvent.click(screen.getByRole('button', { name: 'Show data table' }));
        expect(
          await screen.findByRole('table', { name: 'Weekly signups data' }),
          String(_kind)
        ).toBeTruthy();
        expect(document.querySelector('[data-mode="dark"]'), String(_kind)).toBeTruthy();

        cleanup();
      }
    })();
    cleanup();
    // explores points by keyboard and toggles a series on a line chart
    await (async () => {
      render(LineChart, {
        title: 'Weekly signups',
        description: 'Signups and trials by day.',
        series,
      });
      await waitForInteractiveChart(/Weekly signups/);
      const explorer = screen.getByRole('application', { name: /Weekly signups/ });
      await fireEvent.focus(explorer);
      const live = () => document.querySelector('[data-chart-live]')?.textContent ?? '';
      await waitFor(() => expect(live()).toMatch(/Signups.*Point 1 of/));
      await fireEvent.keyDown(explorer, { key: 'ArrowRight' });
      await waitFor(() => expect(live()).toMatch(/Point 2 of/));
      await fireEvent.keyDown(explorer, { key: 'PageDown' });
      await waitFor(() => expect(live()).toMatch(/Trials/));
      expect(document.querySelector('[data-chart-tooltip]')).toBeTruthy();

      await fireEvent.click(screen.getByRole('button', { name: 'Signups' }));
      await fireEvent.focus(explorer);
      await waitFor(() => expect(live()).toMatch(/Trials/));
      expect(document.querySelector('[data-line="signups"]')).toBeNull();
      expect(document.querySelector('[data-line="trials"]')).toBeTruthy();
    })();
    cleanup();
    // renders annotations and includes them in keyboard exploration order
    await (async () => {
      render(LineChart, {
        title: 'Weekly signups',
        description: 'Signups and trials by day.',
        interactive: true,
        annotations: [
          { id: 'goal', type: 'line', axis: 'y', value: 4, label: 'Target is four' },
          { id: 'release', type: 'point', x: 'Tue', y: 6, label: 'Release day' },
        ],
        series: [
          {
            id: 'signups',
            label: 'Signups',
            points: [
              { x: 'Mon', y: 2 },
              { x: 'Tue', y: 3 },
            ],
          },
        ],
      });
      await waitForInteractiveChart(/Weekly signups/);
      expect(document.querySelectorAll('[data-annotation]')).toHaveLength(2);
      const explorer = screen.getByRole('application', { name: /Weekly signups/ });
      await fireEvent.focus(explorer);
      await fireEvent.keyDown(explorer, { key: 'PageDown' });
      await waitFor(() =>
        expect(document.querySelector('[data-chart-live]')?.textContent).toBe(
          'Annotation: Target is four.'
        )
      );
      await fireEvent.keyDown(explorer, { key: 'ArrowRight' });
      await waitFor(() =>
        expect(document.querySelector('[data-chart-live]')?.textContent).toBe(
          'Annotation: Release day.'
        )
      );
    })();
    cleanup();
    // renders data annotations in the static Cartesian fallback
    render(LineChart, {
      title: 'Weekly signups',
      description: 'Signups and trials by day.',
      interactive: false,
      annotations: [{ id: 'goal', type: 'line', axis: 'y', value: 4, label: 'Target is four' }],
      series: [{ id: 'signups', label: 'Signups', points: [{ x: 'Mon', y: 2 }] }],
    });
    expect(document.querySelector('[data-annotation="goal"]')).toBeTruthy();
    expect(document.querySelector('[data-chart-explorer]')).toBeNull();
    cleanup();
    // renders mixed bars and lines for combo charts
    await (async () => {
      render(ComboChart, {
        title: 'Orders and rate',
        description: 'Orders with conversion rate.',
        series,
      });
      await waitForInteractiveChart(/Orders and rate/);
      expect(document.querySelectorAll('rect[data-series]')).toHaveLength(2);
      expect(document.querySelector('[data-line="trials"]')).toBeTruthy();
    })();
    cleanup();
    // does not draw line paths over bars
    await (async () => {
      for (const [_kind, Component] of [
        ['grouped bars', BarChart],
        ['stacked bars', StackedBarChart],
      ] as const) {
        render(Component, {
          title: 'Weekly signups',
          description: 'Signups and trials by day.',
          series,
        });
        await waitForInteractiveChart(/Weekly signups/);
        expect(document.querySelectorAll('path[data-line]'), String(_kind)).toHaveLength(0);

        cleanup();
      }
    })();
    cleanup();
    // grows from zero and clips every bar to the plot box
    await (async () => {
      for (const [_kind, Component] of [
        ['grouped bars', BarChart],
        ['combo bars', ComboChart],
      ] as const) {
        render(Component, {
          title: 'Positive values',
          description: 'Positive values begin at the zero baseline.',
          series,
        });
        await waitForInteractiveChart(/Positive values/);
        const bars = [...document.querySelectorAll('rect[data-series]')];
        expect(bars.length, String(_kind)).toBeGreaterThan(0);
        const extents = bars.map((bar) => {
          const y = Number(bar.getAttribute('y'));
          const height = Number(bar.getAttribute('height'));
          return { top: y, bottom: y + height };
        });
        expect(
          extents.every(({ top, bottom }) => top >= 18 && bottom <= 272),
          String(_kind)
        ).toBe(true);
        expect(Math.max(...extents.map(({ bottom }) => bottom)), String(_kind)).toBeCloseTo(272);

        cleanup();
      }
    })();
    cleanup();
    // places its first and last point at the category band centers
    await (async () => {
      for (const [_kind, Component] of [
        ['line', LineChart],
        ['area', AreaChart],
        ['combo line', ComboChart],
      ] as const) {
        const points = [
          { x: 0, y: 2 },
          { x: 1, y: 4 },
          { x: 2, y: 3 },
        ];
        const chartSeries: CartesianSeries[] =
          Component === ComboChart
            ? [
                { id: 'bars', label: 'Bars', points },
                { id: 'line', label: 'Line', points },
              ]
            : [{ id: 'line', label: 'Line', points }];
        render(Component, {
          title: 'Category positions',
          description: 'Line points align with category labels.',
          series: chartSeries,
        });
        await waitForInteractiveChart(/Category positions/);

        const path = document.querySelector('path[data-line]');
        expect(path, String(_kind)).toBeTruthy();
        const pointsInPath = [
          ...(path?.getAttribute('d') ?? '').matchAll(
            /[ML](-?(?:\d+\.?\d*|\.\d+)),(-?(?:\d+\.?\d*|\.\d+))/g
          ),
        ];
        const labelX = (label: string) => {
          const node = [...document.querySelectorAll('[data-chart-axis="x"] text')].find(
            (text) => text.textContent?.trim() === label
          );
          return Number(node?.getAttribute('x')) + 58;
        };
        const category = bandScale({
          domain: ['0', '1', '2'],
          range: [58, 622],
          paddingInner: 0.18,
          paddingOuter: 0.1,
        });
        expect(Number(pointsInPath[0]?.[1]), String(_kind)).toBeCloseTo(
          (category('0') ?? 0) + category.bandwidth() / 2
        );
        expect(Number(pointsInPath.at(-1)?.[1]), String(_kind)).toBeCloseTo(
          (category('2') ?? 0) + category.bandwidth() / 2
        );
        expect(Number(pointsInPath[0]?.[1]), String(_kind)).toBeCloseTo(labelX('0'));
        expect(Number(pointsInPath.at(-1)?.[1]), String(_kind)).toBeCloseTo(labelX('2'));

        cleanup();
      }
    })();
    cleanup();
    // surfaces invalid data rather than silently drawing a misleading chart
    expect(() =>
      render(CartesianChart, {
        kind: 'line',
        title: 'Bad',
        description: 'Invalid data.',
        series: [{ id: 'bad', label: 'Bad', points: [{ x: 1, y: Number.NaN }] }],
      })
    ).toThrow(/finite values/);
    cleanup();
    // requires a chart description so the SVG always has accessible context
    expect(() => render(LineChart, { title: 'No description', description: '', series })).toThrow(
      /accessible description/
    );
  }, 20_000);
});

describe('Cartesian chart family cohesion', () => {
  it('renders the grammar-mandated h2 figure title, and 3 related cases', () => {
    {
      // renders the grammar-mandated h2 figure title
      const { container } = render(LineChart, {
        title: 'Weekly signups',
        description: 'Signups by day.',
        series: [series[0] as CartesianSeries],
        interactive: false,
      });
      expect(container.querySelector('figcaption h2')).toBeTruthy();
      expect(container.querySelector('figcaption h3')).toBeNull();
    }
    cleanup();
    {
      // keeps the sibling caption styles for the figure title and description
      const source = readFileSync(
        resolve(__dirname, '../src/cartesian/CartesianChart.svelte'),
        'utf8'
      );
      const css = compile(source, {
        filename: 'CartesianChart.svelte',
        css: 'external',
      }).css?.code;
      // The grammar assigns Cartesian titles rank 2; keep the visual title size at 1rem.
      expect(css).toMatch(/figcaption[^{]*h2[^{]*\{[^}]*font-size:\s*1rem/);
      expect(css).toMatch(/figcaption[^{]*h2[^{]*\{[^}]*margin-block:\s*0/);
      expect(css).toMatch(/figcaption[^{]*p[^{]*\{[^}]*margin-block:\s*0\.25rem\s+0\.75rem/);
    }
    cleanup();
    // rejects duplicate x values within a series before they collide as bar keys
    expect(() =>
      assertCartesianSeries([
        {
          id: 'twice',
          label: 'Twice',
          points: [
            { x: 'Mon', y: 1 },
            { x: 'Mon', y: 2 },
          ],
        },
      ])
    ).toThrow(/duplicate x/i);
    expect(() =>
      assertCartesianSeries([
        {
          id: 'numeric',
          label: 'Numeric',
          points: [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 2, y: 3 },
          ],
        },
      ])
    ).toThrow(/duplicate x/i);
    expect(() =>
      render(BarChart, {
        title: 'Colliding bars',
        description: 'Duplicate x points would collide as bar keys.',
        series: [
          {
            id: 'dup',
            label: 'Dup',
            points: [
              { x: 'Mon', y: 1 },
              { x: 'Mon', y: 2 },
            ],
          },
        ],
        interactive: false,
      })
    ).toThrow(/duplicate x/i);
    cleanup();
    {
      // keeps grouped bar geometry identical between the SVG and canvas renderers
      const januaryToApril = [
        { x: 'Jan', y: 12 },
        { x: 'Feb', y: 18 },
        { x: 'Mar', y: 9 },
        { x: 'Apr', y: 15 },
      ];
      const groupedSeries: CartesianSeries[] = [
        { id: 'new', label: 'New accounts', points: januaryToApril },
        {
          id: 'returning',
          label: 'Returning accounts',
          points: januaryToApril.map((point) => ({ x: point.x, y: point.y - 4 })),
        },
      ];
      const props = {
        title: 'Grouped bars',
        description: 'Two grouped series in one category band.',
        series: groupedSeries,
        interactive: false,
      };

      const svg = render(BarChart, { ...props, renderer: 'svg' });
      const svgBars = [...svg.container.querySelectorAll('rect[data-series]')].map((rect) => ({
        x: Number(rect.getAttribute('x')),
        y: Number(rect.getAttribute('y')),
        width: Number(rect.getAttribute('width')),
        height: Number(rect.getAttribute('height')),
      }));
      expect(svgBars).toHaveLength(8);

      const fillRect = vi.fn();
      const context = {
        clearRect: vi.fn(),
        fillRect,
        setTransform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      const getContext = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(context);
      try {
        const canvas = render(BarChart, { ...props, renderer: 'canvas' });
        expect(canvas.container.querySelectorAll('canvas')).toHaveLength(1);
        // drawCanvasChart paints series by series, matching model.bars order.
        const canvasBars = fillRect.mock.calls.map((call) => ({
          x: call[0] as number,
          y: call[1] as number,
          width: call[2] as number,
          height: call[3] as number,
        }));
        expect(canvasBars).toHaveLength(8);
        expect(svgBars).toHaveLength(canvasBars.length);
        svgBars.forEach((bar, index) => {
          const canvasBar = canvasBars[index] as {
            x: number;
            y: number;
            width: number;
            height: number;
          };
          expect(Math.abs(bar.x - canvasBar.x)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(bar.y - canvasBar.y)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(bar.width - canvasBar.width)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(bar.height - canvasBar.height)).toBeLessThanOrEqual(0.5);
        });
      } finally {
        getContext.mockRestore();
        vi.restoreAllMocks();
      }
    }
  });
});

describe('axis', () => {
  afterEach(cleanup);

  describe('axis formatting', () => {
    it('formats strings, numbers, compact magnitudes and exact fractional steps deterministically; formats time ticks using the selected UTC interval', () => {
      // formats strings, numbers, compact magnitudes and exact fractional steps deterministically
      expect(formatAxisValue('Mon')).toBe('Mon');
      expect(formatAxisValue(1234.567)).toBe('1,234.57');
      expect(formatNumericAxisTick(1250, { compact: true })).toBe('1.3K');
      expect(formatNumericAxisTick(0.5, { step: 0.25 })).toBe('0.50');
      cleanup();
      // formats time ticks using the selected UTC interval
      expect(formatTimeAxisTick(Date.UTC(2026, 2, 2), { unit: 'year', step: 1 })).toBe('2026');
      expect(formatTimeAxisTick(Date.UTC(2026, 2, 2), { unit: 'day', step: 1 })).toBe('Mar 2');
    });
  });

  describe('Axis', () => {
    it('renders reusable x/y tick geometry, labels, baseline and optional grid lines', () => {
      const { container } = render(Axis, {
        props: {
          orientation: 'y',
          ticks: [
            { value: 0, position: 100 },
            { value: 10, position: 0 },
          ],
          length: 100,
          gridLength: 200,
          format: (value: Parameters<AxisFormatter>[0]) => `${value} requests`,
        },
      });
      const axis = container.querySelector('[data-chart-axis="y"]');
      expect(axis?.getAttribute('aria-hidden')).toBe('true');
      expect(axis?.querySelectorAll('.tx-chart-axis__domain')).toHaveLength(1);
      expect(axis?.querySelectorAll('.tx-chart-axis__grid')).toHaveLength(2);
      expect(axis?.querySelectorAll('.tx-chart-axis__tick')).toHaveLength(2);
      expect(axis?.textContent).toContain('0 requests');
      expect(axis?.textContent).toContain('10 requests');
    });
  });
});
