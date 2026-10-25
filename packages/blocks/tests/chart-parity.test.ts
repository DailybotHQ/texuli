import { cleanup, render, screen } from '@testing-library/svelte';
import { chartPropSchemas } from '@texuli/charts/schemas';
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
  it('accepts every chart schema id as a block kind', () => {
    const ids = Object.keys(chartPropSchemas)
      .map((id) => id.slice('charts-'.length))
      .sort();
    expect([...CHART_KINDS].sort()).toEqual(ids);
  });

  it('keeps every kind inside its chart blueprint props', () => {
    const specs = { ...INLINE_CHART_PROPS, ...CHART_KIND_PROPS };
    expect(Object.keys(specs).sort()).toEqual([...CHART_KINDS].sort());
    for (const [kind, fields] of Object.entries(specs)) {
      const schema = chartPropSchemas[`charts-${kind}` as keyof typeof chartPropSchemas];
      const blueprint = schema.props.filter(
        (prop) => (prop as { exposure?: string }).exposure !== 'developer' && prop.kind !== 'event'
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
  });

  it.each(CHART_KINDS)('parses and renders a %s block', async (kind) => {
    const block = chartBlock(kind, FIXTURES[kind]);
    const parsed = safeParseBlock(block);
    expect(parsed.issues).toEqual([]);
    render(DataBlockView, { props: { block } });
    expect(await screen.findAllByText(`Fictional ${kind}`)).not.toHaveLength(0);
    expect(document.querySelector('.tx-block-chart-error')).toBeNull();
  });
});

describe('cartesian and matrix extras', () => {
  const annotations = [
    { id: 'goal', type: 'line', axis: 'y', value: 15, label: 'Goal', color: 'var(--tx-chart-2)' },
    { id: 'promo', type: 'band', axis: 'x', start: 'W1', end: 'W2', label: 'Promo' },
    { id: 'peak', type: 'point', x: 'W2', y: 18, label: 'Peak' },
  ];
  const withProps = (kind: string, props: unknown) =>
    chartBlock(kind, { ...FIXTURES[kind as ChartKind], props });

  it('accepts annotations, renderer, interactive and fullDomain on cartesian kinds', async () => {
    const block = withProps('line', {
      annotations,
      renderer: 'svg',
      interactive: false,
      fullDomain: [0, 10],
    });
    const parsed = safeParseBlock(block);
    expect(parsed.issues).toEqual([]);
    expect(parsed.data).toMatchObject({ props: { renderer: 'svg', interactive: false } });
    render(DataBlockView, { props: { block } });
    expect(await screen.findAllByText('Fictional line')).not.toHaveLength(0);
    expect(document.querySelector('.tx-block-chart-error')).toBeNull();
  });

  it('accepts width, height, interactive, annotations and series labels on matrix kinds', async () => {
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
  });

  it('rejects extras on families whose schema lacks them', () => {
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
  });
});

describe('matrix top-level data', () => {
  const parses = (kind: string, body: Record<string, unknown>) =>
    safeParseBlock(chartBlock(kind, body)).success;
  const point = { id: 'a', label: 'A', x: 1, y: 2 };

  it('accepts token colors and keeps r required for bubbles', () => {
    expect(parses('scatter', { points: [{ ...point, color: 'var(--tx-chart-3)' }] })).toBe(true);
    expect(parses('scatter', { points: [{ ...point, color: 'red' }] })).toBe(false);
    expect(parses('bubble', { points: [point] })).toBe(false);
    expect(parses('scatter', { points: [{ ...point, r: -1 }] })).toBe(false);
  });

  it('closes cell and point objects and keeps ids unique tokens', () => {
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

  it('accepts null gaps, numeric x and token colors', () => {
    expect(parses([{ ...one, color: 'var(--tx-chart-2)', points: [{ x: 1, y: null }] }])).toBe(
      true
    );
  });

  it('rejects empty, oversized and open series data', () => {
    expect(parses([])).toBe(false);
    expect(parses([{ ...one, points: [] }])).toBe(false);
    expect(parses(Array.from({ length: 9 }, (_, i) => ({ ...one, id: `s${i}` })))).toBe(false);
    expect(parses([{ ...one, points: Array.from({ length: 65 }, (_, x) => ({ x, y: 1 })) }])).toBe(
      false
    );
    expect(parses([{ ...one, onclick: 'x' }])).toBe(false);
    expect(parses([{ ...one, points: [{ x: 'W1', y: 1, label: 'x' }] }])).toBe(false);
    expect(parses([one, one])).toBe(false);
  });
});

describe('extended chart kinds reject hostile props', () => {
  const rejects = (kind: string, props: unknown) =>
    expect(safeParseBlock(chartBlock(kind, { props })).success).toBe(false);

  it('requires props and closes the prop set', () => {
    expect(safeParseBlock(chartBlock('pie')).success).toBe(false);
    rejects('pie', { data: [{ id: 'a', label: 'A', value: 1 }], class: 'x' });
    rejects('gauge', { value: 1, format: 'x' });
    rejects('pie', { data: [{ id: 'a', label: 'A', value: 1, extra: true }] });
    rejects('pie', Object.create({ data: [] }));
  });

  it('rejects unsafe text, non-finite numbers and duplicate ids', () => {
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
  });

  it('caps sizes, hierarchy depth and calendar spans', () => {
    rejects('sparkline', { values: Array.from({ length: 257 }, () => 1) });
    rejects('treemap', { root: tree, width: 100_000 });
    let deep: Record<string, unknown> = { id: 'leaf', value: 1 };
    for (let i = 0; i < 7; i += 1) deep = { id: `n${i}`, children: [deep] };
    rejects('pack', { root: deep });
    rejects('calendar', { start: '2020-01-01', end: '2026-01-01' });
    rejects('calendar', { start: '2026-02-01', end: '2026-01-01' });
    rejects('calendar', { start: 'yesterday', end: '2026-01-01' });
  });

  it('requires flow links to name known nodes', () => {
    rejects('sankey', { nodes: flowNodes, links: [{ source: 'visit', target: 'gone', value: 1 }] });
    rejects('network', { nodes: flowNodes, links: [{ source: 'x', target: 'trial' }] });
  });
});
