import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { assertCartesianSeries, type CartesianSeries } from '@texuli/charts/cartesian';
import { chartPropSchemas } from '@texuli/charts/schemas';
import { compile } from 'svelte/compiler';
import { afterEach, describe, expect, it } from 'vitest';
import { safeParseBlock } from '../src/core/index.ts';
import { CHART_KIND_PROPS, INLINE_CHART_PROPS } from '../src/data/chart-kinds.ts';
import DataBlockView from '../src/data/DataBlockView.svelte';
import { CHART_KINDS, type ChartKind } from '../src/data/schema.ts';

afterEach(() => cleanup());

/** Block-owned fields: the block's title/description, and the host's color mode. */
const BLOCK_OWNED = new Set(['title', 'description', 'label', 'mode']);
const series = [
  {
    id: 'new',
    label: 'New',
    points: [
      { x: 'W1', y: 12 },
      { x: 'W2', y: 18 },
    ],
  },
];
const tree = {
  id: 'all',
  label: 'All teams',
  children: [
    { id: 'design', label: 'Design', value: 4 },
    { id: 'build', label: 'Build', value: 7 },
  ],
};
const flowNodes = [
  { id: 'visit', label: 'Visit' },
  { id: 'trial', label: 'Trial' },
];

/** One valid fictional block body per chart id (top-level for inline kinds, else `props`). */
const FIXTURES: Record<ChartKind, Record<string, unknown>> = {
  line: { series },
  area: { series },
  bar: { series },
  'stacked-bar': { series },
  combo: { series },
  heatmap: { cells: [{ x: 'Mon', y: 'AM', value: 3 }] },
  scatter: { points: [{ id: 'a', label: 'A', x: 1, y: 2 }] },
  bubble: { points: [{ id: 'a', label: 'A', x: 1, y: 2, r: 3 }] },
  pie: { props: { data: [{ id: 'a', label: 'Alpha', value: 3 }] } },
  donut: { props: { data: [{ id: 'a', label: 'Alpha', value: 3 }], innerRatio: 0.5 } },
  sunburst: { props: { root: tree } },
  treemap: { props: { root: tree, padding: 1 } },
  sparkline: { props: { values: [1, null, 3], variant: 'bar' } },
  bullet: { props: { value: 62, target: 70, ranges: [40, 80] } },
  gauge: { props: { value: 42, thresholds: [30, 70], bandLabels: ['Low', 'Mid', 'High'] } },
  'progress-ring': { props: { value: 3, max: 5 } },
  funnel: {
    props: {
      steps: [
        { id: 'visit', value: 100 },
        { id: 'trial', value: 40 },
      ],
    },
  },
  sankey: { props: { nodes: flowNodes, links: [{ source: 'visit', target: 'trial', value: 5 }] } },
  network: { props: { nodes: flowNodes, links: [{ source: 'visit', target: 'trial' }] } },
  'geo-map': {
    props: {
      data: { north: 4, south: null },
      shape: [
        { id: 'north', label: 'North', abbr: 'N', col: 0, row: 0 },
        { id: 'south', label: 'South', abbr: 'S', col: 0, row: 1 },
      ],
    },
  },
  'geo-point-map': {
    props: {
      points: [{ id: 'hq', label: 'HQ', regionId: 'north', value: 2, offset: { x: 0.1, y: 0 } }],
      shape: [{ id: 'north', label: 'North', abbr: 'N', col: 0, row: 0 }],
    },
  },
  histogram: { props: { values: [1, 2, 2, 3, 5, null], binCount: 4 } },
  pack: { props: { root: tree } },
  calendar: {
    props: { start: '2026-01-01', end: '2026-01-31', values: { '2026-01-05': 2 }, weekStartsOn: 1 },
  },
};

function chartBlock(kind: string, body: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'chart',
    kind,
    title: `Fictional ${kind}`,
    description: `A fictional ${kind} chart.`,
    ...body,
  };
}

/** Inline kinds keep their data at the block's top level, outside `props`. */
const TOP_LEVEL: Record<string, string> = { heatmap: 'cells', scatter: 'points', bubble: 'points' };

function fieldName(key: string): string {
  return key.endsWith('!') ? key.slice(0, -1) : key;
}

describe('chart block parity with @texuli/charts', () => {
  it('accepts every chart schema id as a block kind; keeps every kind inside its chart blueprint props; parses and renders a block', async () => {
    {
      // accepts every chart schema id as a block kind
      const ids = Object.keys(chartPropSchemas)
        .map((id) => id.slice('charts-'.length))
        .sort();
      expect([...CHART_KINDS].sort()).toEqual(ids);
    }
    cleanup();
    {
      // keeps every kind inside its chart blueprint props
      const specs = { ...INLINE_CHART_PROPS, ...CHART_KIND_PROPS };
      expect(Object.keys(specs).sort()).toEqual([...CHART_KINDS].sort());
      for (const [kind, fields] of Object.entries(specs)) {
        const schema = chartPropSchemas[`charts-${kind}` as keyof typeof chartPropSchemas];
        const blueprint = schema.props.filter(
          (prop) =>
            (prop as { exposure?: string }).exposure !== 'developer' && prop.kind !== 'event'
        );
        const names = new Set<string>(blueprint.map((prop) => prop.name));
        for (const key of Object.keys(fields)) {
          expect(names.has(fieldName(key)), `${kind}.${key}`).toBe(true);
        }
        const accepted = new Set(Object.keys(fields).map(fieldName));
        const required = new Set(
          Object.keys(fields)
            .filter((key) => key.endsWith('!'))
            .map(fieldName)
        );
        for (const prop of blueprint) {
          if (BLOCK_OWNED.has(prop.name)) continue;
          if (kind in INLINE_CHART_PROPS && prop.name === (TOP_LEVEL[kind] ?? 'series')) continue;
          // Every blueprint prop is reachable, and chart-required data stays required.
          expect(accepted.has(prop.name), `${kind} accepts ${prop.name}`).toBe(true);
          if (prop.required && prop.name !== 'labels') {
            expect(required.has(prop.name), `${kind} requires ${prop.name}`).toBe(true);
          }
        }
      }
    }
    cleanup();
    // parses and renders a block
    await (async () => {
      for (const kind of CHART_KINDS) {
        const block = chartBlock(kind, FIXTURES[kind]);
        const parsed = safeParseBlock(block);
        expect(parsed.issues, String(kind)).toEqual([]);
        render(DataBlockView, { props: { block } });
        expect(await screen.findAllByText(`Fictional ${kind}`), String(kind)).not.toHaveLength(0);
        expect(document.querySelector('.tx-block-chart-error'), String(kind)).toBeNull();

        cleanup();
      }
    })();
  }, 20_000);
});

describe('cartesian and matrix extras', () => {
  const annotations = [
    { id: 'goal', type: 'line', axis: 'y', value: 15, label: 'Goal', color: 'var(--tx-chart-2)' },
    { id: 'promo', type: 'band', axis: 'x', start: 'W1', end: 'W2', label: 'Promo' },
    { id: 'peak', type: 'point', x: 'W2', y: 18, label: 'Peak' },
  ];
  const withProps = (kind: string, props: unknown) =>
    chartBlock(kind, { ...FIXTURES[kind as ChartKind], props });
  it('accepts annotations, renderer, interactive, fullDomain, xKind and locale on cartesian kinds, and 2 related cases', async () => {
    // accepts annotations, renderer, interactive, fullDomain, xKind and locale on cartesian kinds
    await (async () => {
      const block = withProps('line', {
        annotations,
        renderer: 'svg',
        interactive: false,
        fullDomain: [0, 10],
        xKind: 'category',
        locale: 'en-US',
      });
      const parsed = safeParseBlock(block);
      expect(parsed.issues).toEqual([]);
      expect(parsed.data).toMatchObject({
        props: { renderer: 'svg', interactive: false, xKind: 'category', locale: 'en-US' },
      });
      // G97: an unknown x-axis kind is refused like any closed-set value.
      expect(safeParseBlock(withProps('line', { xKind: 'calendar' })).issues).not.toEqual([]);
      render(DataBlockView, { props: { block } });
      expect(await screen.findAllByText('Fictional line')).not.toHaveLength(0);
      expect(document.querySelector('.tx-block-chart-error')).toBeNull();
    })();
    cleanup();
    // accepts width, height, interactive, annotations and series labels on matrix kinds
    await (async () => {
      const heatmap = withProps('heatmap', {
        width: 480,
        height: 240,
        interactive: true,
        annotations: [{ id: 'q', type: 'line', axis: 'y', value: 'AM', label: 'Morning' }],
      });
      expect(safeParseBlock(heatmap).data).toMatchObject({ props: { width: 480, height: 240 } });
      const scatter = withProps('scatter', { series: [{ id: 'teams', label: 'Teams' }] });
      expect(safeParseBlock(scatter).data).toMatchObject({ props: { series: [{ id: 'teams' }] } });
      render(DataBlockView, { props: { block: heatmap } });
      expect(await screen.findAllByText('Fictional heatmap')).not.toHaveLength(0);
      expect(document.querySelector('.tx-block-chart-error')).toBeNull();
    })();
    cleanup();
    {
      // rejects extras on families whose schema lacks them
      const rejects = (kind: string, props: unknown) =>
        expect(safeParseBlock(withProps(kind, props)).success, JSON.stringify(props)).toBe(false);
      rejects('line', { width: 400 });
      rejects('heatmap', { renderer: 'canvas' });
      rejects('bar', { mode: 'dark' });
      rejects('area', { renderer: 'webgl' });
      rejects('line', { annotations: [{ ...annotations[0], color: 'red' }] });
      rejects('line', { annotations: [{ ...annotations[0], value: 'high' }] });
      rejects('line', { annotations: [annotations[0], annotations[0]] });
      rejects('line', { annotations: [{ ...annotations[2], type: 'arrow' }] });
      rejects('line', {
        annotations: Array.from({ length: 17 }, (_, i) => ({ ...annotations[0], id: `a${i}` })),
      });
      rejects('scatter', { width: 0 });
    }
  });
});

describe('matrix top-level data', () => {
  const parses = (kind: string, body: Record<string, unknown>) =>
    safeParseBlock(chartBlock(kind, body)).success;
  const point = { id: 'a', label: 'A', x: 1, y: 2 };
  it('accepts token colors and keeps r required for bubbles; closes cell and point objects and keeps ids unique tokens', () => {
    // accepts token colors and keeps r required for bubbles
    expect(parses('scatter', { points: [{ ...point, color: 'var(--tx-chart-3)' }] })).toBe(true);
    expect(parses('scatter', { points: [{ ...point, color: 'red' }] })).toBe(false);
    expect(parses('bubble', { points: [point] })).toBe(false);
    expect(parses('scatter', { points: [{ ...point, r: -1 }] })).toBe(false);
    cleanup();
    // closes cell and point objects and keeps ids unique tokens
    expect(parses('scatter', { points: [{ ...point, onclick: 'x' }] })).toBe(false);
    expect(parses('scatter', { points: [{ ...point, id: 'Not A Token' }] })).toBe(false);
    expect(parses('scatter', { points: [point, point] })).toBe(false);
    expect(parses('scatter', { points: [] })).toBe(false);
    expect(parses('heatmap', { cells: [{ x: 'Mon', y: 'AM', value: 1, style: 'x' }] })).toBe(false);
    expect(
      parses('heatmap', {
        cells: Array.from({ length: 401 }, (_, i) => ({ x: `c${i}`, y: 'AM', value: 1 })),
      })
    ).toBe(false);
  });
});

describe('cartesian top-level series', () => {
  const parses = (value: unknown) => safeParseBlock(chartBlock('line', { series: value })).success;
  const one = { id: 'a', label: 'A', points: [{ x: 'W1', y: 1 }] };
  it('accepts null gaps, numeric x and token colors, and 4 related cases', () => {
    // accepts null gaps, numeric x and token colors
    expect(parses([{ ...one, color: 'var(--tx-chart-2)', points: [{ x: 1, y: null }] }])).toBe(
      true
    );
    cleanup();
    // rejects empty, oversized and open series data
    expect(parses([])).toBe(false);
    expect(parses([{ ...one, points: [] }])).toBe(false);
    expect(parses(Array.from({ length: 9 }, (_, i) => ({ ...one, id: `s${i}` })))).toBe(false);
    expect(parses([{ ...one, points: Array.from({ length: 65 }, (_, x) => ({ x, y: 1 })) }])).toBe(
      false
    );
    expect(parses([{ ...one, onclick: 'x' }])).toBe(false);
    expect(parses([{ ...one, points: [{ x: 'W1', y: 1, label: 'x' }] }])).toBe(false);
    expect(parses([one, one])).toBe(false);
    cleanup();
    // rejects the x values the cartesian renderers refuse to draw
    // Duplicate x within one series (the charts ask callers to aggregate first).
    expect(
      parses([
        {
          ...one,
          points: [
            { x: 'W1', y: 1 },
            { x: 'W1', y: 2 },
          ],
        },
      ])
    ).toBe(false);
    expect(
      parses([
        {
          ...one,
          points: [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 2, y: 3 },
          ],
        },
      ])
    ).toBe(false);
    // Category and numeric x mixed in one series, or across the chart.
    expect(
      parses([
        {
          ...one,
          points: [
            { x: 'W1', y: 1 },
            { x: 2, y: 2 },
          ],
        },
      ])
    ).toBe(false);
    expect(parses([one, { id: 'b', label: 'B', points: [{ x: 1, y: 1 }] }])).toBe(false);
    cleanup();
    // accepts the same x in different series (grouped and stacked bars)
    expect(parses([one, { id: 'b', label: 'B', points: [{ x: 'W1', y: 3 }] }])).toBe(true);
    cleanup();
    {
      // agrees with the charts validator on every cartesian series sample
      const samples: CartesianSeries[][] = [
        [one],
        [
          {
            ...one,
            points: [
              { x: 'W1', y: 1 },
              { x: 'W1', y: 2 },
            ],
          },
        ],
        [
          {
            ...one,
            points: [
              { x: 3, y: 1 },
              { x: 3, y: null },
            ],
          },
        ],
        [
          {
            ...one,
            points: [
              { x: 'W1', y: 1 },
              { x: 2, y: 2 },
            ],
          },
        ],
        [one, { id: 'b', label: 'B', points: [{ x: 1, y: 1 }] }],
        [one, { id: 'b', label: 'B', points: [{ x: 'W1', y: 3 }] }],
      ];
      for (const sample of samples) {
        let rendered = true;
        try {
          assertCartesianSeries(sample);
        } catch {
          rendered = false;
        }
        expect(parses(sample), JSON.stringify(sample)).toBe(rendered);
      }
    }
  });
});

describe('extended chart kinds reject hostile props', () => {
  const rejects = (kind: string, props: unknown) =>
    expect(safeParseBlock(chartBlock(kind, { props })).success).toBe(false);
  it('requires props and closes the prop set, and 3 related cases', () => {
    // requires props and closes the prop set
    expect(safeParseBlock(chartBlock('pie')).success).toBe(false);
    rejects('pie', { data: [{ id: 'a', label: 'A', value: 1 }], class: 'x' });
    rejects('gauge', { value: 1, format: 'x' });
    rejects('pie', { data: [{ id: 'a', label: 'A', value: 1, extra: true }] });
    rejects('pie', Object.create({ data: [] }));
    cleanup();
    // rejects unsafe text, non-finite numbers and duplicate ids
    rejects('pie', { data: [{ id: 'a', label: 'A\u202e', value: 1 }] });
    rejects('pie', { data: [{ id: 'a', label: 'A', value: Number.NaN }] });
    rejects('funnel', {
      steps: [
        { id: 'a', value: 1 },
        { id: 'a', value: 2 },
      ],
    });
    rejects('sparkline', { values: [1], variant: 'pie' });
    rejects('geo-map', { data: { 'a\nb': 1 } });
    cleanup();
    {
      // caps sizes, hierarchy depth and calendar spans
      rejects('sparkline', { values: Array.from({ length: 257 }, () => 1) });
      rejects('treemap', { root: tree, width: 100_000 });
      let deep: Record<string, unknown> = { id: 'leaf', value: 1 };
      for (let i = 0; i < 7; i += 1) deep = { id: `n${i}`, children: [deep] };
      rejects('pack', { root: deep });
      rejects('calendar', { start: '2020-01-01', end: '2026-01-01' });
      rejects('calendar', { start: '2026-02-01', end: '2026-01-01' });
      rejects('calendar', { start: 'yesterday', end: '2026-01-01' });
    }
    cleanup();
    // requires flow links to name known nodes
    rejects('sankey', { nodes: flowNodes, links: [{ source: 'visit', target: 'gone', value: 1 }] });
    rejects('network', { nodes: flowNodes, links: [{ source: 'x', target: 'trial' }] });
  });
});

describe('chart block rendering', () => {
  afterEach(() => cleanup());

  const base = { type: 'chart', title: 'Fictional chart', description: 'A fictional summary.' };
  const points = [{ id: 'a', label: 'Alpha', x: 1, y: 2, seriesId: 'core' }];

  /** Reads a family view source relative to the blocks package root. */
  const sourceOf = (relative: string) =>
    readFileSync(resolve(__dirname, '../src', relative), 'utf8');

  describe('chart block rendering', () => {
    it('does not apply matrix frame SVG sizing to a chart legend symbol, and 6 related cases', async () => {
      {
        // does not apply matrix frame SVG sizing to a chart legend symbol
        const source = readFileSync(
          resolve(__dirname, '../../charts/src/matrix/MatrixFrame.svelte'),
          'utf8'
        );
        const compiled = compile(source, { filename: 'MatrixFrame.svelte', css: 'external' });
        const style = document.createElement('style');
        style.textContent = compiled.css?.code ?? '';
        document.head.append(style);

        const chart = document.createElement('figure');
        chart.className = 'chart';
        const legend = document.createElement('ul');
        legend.className = 'legend';
        const item = document.createElement('li');
        const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        symbol.classList.add('tx-chart-legend__symbol');
        item.append(symbol);
        legend.append(item);
        chart.append(legend);

        const matchingRules = Array.from(style.sheet?.cssRules ?? []).filter((rule) => {
          if (!('selectorText' in rule)) return false;
          const cssRule = rule as CSSStyleRule;
          if (cssRule.style.getPropertyValue('inline-size') !== '100%') return false;
          const selector = cssRule.selectorText.replace(/\.svelte-[a-z0-9]+/g, '');
          return symbol.matches(selector);
        });

        style.remove();
        expect(matchingRules).toHaveLength(0);
      }
      cleanup();
      {
        // keeps chart text from breaking at every character (legends stay readable)
        // jsdom does not inject component styles, so cascade the compiled CSS by hand.
        const source = readFileSync(resolve(__dirname, '../src/data/DataBlockView.svelte'), 'utf8');
        const style = document.createElement('style');
        style.textContent =
          compile(source, { filename: 'DataBlockView.svelte', css: 'external' }).css?.code ?? '';
        document.head.append(style);
        const overflowWrap = (classes: string) => {
          const element = document.createElement('div');
          element.className = classes;
          let value = '';
          for (const rule of style.sheet?.cssRules ?? []) {
            if (!('selectorText' in rule)) continue;
            const { selectorText, style: declarations } = rule as CSSStyleRule;
            const selector = selectorText.replace(/\.svelte-[a-z0-9]+/g, '');
            const declared = declarations.getPropertyValue('overflow-wrap');
            if (declared && element.matches(selector)) value = declared;
          }
          return value;
        };
        const chart = overflowWrap('tx-block tx-block-chart');
        const table = overflowWrap('tx-block tx-block-table');
        style.remove();
        expect(chart).not.toBe('anywhere');
        // Tables and stats keep breaking long unspaced values.
        expect(table).toBe('anywhere');
      }
      cleanup();
      // shows the invalid notice for duplicate x instead of crashing the chart render
      await (async () => {
        const issues: unknown[] = [];
        render(DataBlockView, {
          props: {
            block: {
              ...base,
              kind: 'bar',
              series: [
                {
                  id: 'signups',
                  label: 'Signups',
                  points: [
                    { x: 'Mon', y: 1 },
                    { x: 'Mon', y: 2 },
                  ],
                },
              ],
            },
            oninvalid: (found: unknown) => issues.push(found),
          },
        });
        expect(await screen.findByRole('note')).toBeTruthy();
        expect(document.querySelector('[data-tx-block="invalid"]')).not.toBeNull();
        expect(document.querySelector('figure')).toBeNull();
        expect(issues).toHaveLength(1);
      })();
      cleanup();
      // shows a visible title and description for compact kinds
      await (async () => {
        render(DataBlockView, {
          props: {
            block: { ...base, title: 'Check-in completion', kind: 'gauge', props: { value: 40 } },
          },
        });
        expect(await screen.findByRole('heading', { name: 'Check-in completion' })).toBeTruthy();
        expect(screen.getAllByText('A fictional summary.').length).toBeGreaterThan(0);
      })();
      cleanup();
      // adds theme fallbacks to bare chart tokens so missing tokens never render black
      await (async () => {
        render(DataBlockView, {
          props: {
            block: {
              ...base,
              kind: 'scatter',
              points: [{ ...points[0], color: 'var(--tx-chart-2)' }],
              props: { series: [{ id: 'core', label: 'Core', color: 'var(--tx-chart-2)' }] },
            },
          },
        });
        await waitFor(() => expect(document.querySelector('circle[fill]')).not.toBeNull());
        const fill = document.querySelector('circle[fill]')?.getAttribute('fill') ?? '';
        expect(fill).toBe('var(--tx-chart-2, var(--tx-success, CanvasText))');
      })();
      cleanup();
      {
        // keeps the data invalid notice in the family grammar (dashed border, padding, em size)
        // jsdom does not inject component styles, so cascade the compiled CSS by hand.
        const style = document.createElement('style');
        style.textContent =
          compile(sourceOf('data/DataBlockView.svelte'), {
            filename: 'DataBlockView.svelte',
            css: 'external',
          }).css?.code ?? '';
        document.head.append(style);
        const notice = document.createElement('p');
        notice.className = 'tx-block tx-block-invalid';
        const declarations = new Map<string, string>();
        for (const rule of style.sheet?.cssRules ?? []) {
          if (!('selectorText' in rule)) continue;
          const cssRule = rule as CSSStyleRule;
          const selector = cssRule.selectorText.replace(/\.svelte-[a-z0-9]+/g, '');
          if (!notice.matches(selector)) continue;
          for (const property of ['border-style', 'padding', 'border-radius', 'font-size']) {
            const value = cssRule.style.getPropertyValue(property);
            if (value) declarations.set(property, value);
          }
        }
        style.remove();
        // The text, code, structure and media families all paint the invalid
        // notice with a dashed currentColor border, inner padding and an em size.
        expect(declarations.get('border-style')).toBe('dashed');
        expect(declarations.get('padding')).not.toBe('');
        expect(declarations.get('border-radius')).not.toBe('');
        expect(declarations.get('font-size')).toBe('0.875em');
      }
      cleanup();
      {
        // routes standard text sizes through the font-size tokens like the sibling families
        const raw: string[] = [];
        const sources: Array<[string, string]> = [
          [sourceOf('data/DataBlockView.svelte'), 'DataBlockView.svelte'],
          [sourceOf('data/ChartBlockView.svelte'), 'ChartBlockView.svelte'],
          [sourceOf('media/MediaBlockView.svelte'), 'MediaBlockView.svelte'],
        ];
        for (const [source, filename] of sources) {
          const style = document.createElement('style');
          style.textContent = compile(source, { filename, css: 'external' }).css?.code ?? '';
          document.head.append(style);
          for (const rule of style.sheet?.cssRules ?? []) {
            if (!('selectorText' in rule)) continue;
            const value = (rule as CSSStyleRule).style.getPropertyValue('font-size');
            // 0.875rem and 1rem are the standard sm and base sizes; code, diagram
            // and media route them through --tx-font-size-sm / --tx-font-size-base.
            if (value === '0.875rem' || value === '1rem') {
              raw.push(
                `${filename}: ${(rule as CSSStyleRule).selectorText} { font-size: ${value} }`
              );
            }
          }
          style.remove();
        }
        expect(raw).toEqual([]);
      }
    });
  });
});
