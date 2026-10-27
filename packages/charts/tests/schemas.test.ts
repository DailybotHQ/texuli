// @vitest-environment node
import {
  areaChartSchema,
  barChartSchema,
  bubbleChartSchema,
  bulletChartSchema,
  type ChartComponentPropSchema,
  type ChartObjectSchema,
  type ChartSchemaJson,
  type ChartValueSchema,
  calendarHeatmapSchema,
  chartPropSchemas,
  chartSchemaDefinitions,
  comboChartSchema,
  donutChartSchema,
  funnelChartSchema,
  gaugeSchema,
  geoMapSchema,
  geoPointMapSchema,
  heatmapChartSchema,
  histogramChartSchema,
  lineChartSchema,
  networkGraphSchema,
  packChartSchema,
  pieChartSchema,
  progressRingSchema,
  sankeyChartSchema,
  scatterChartSchema,
  sparklineSchema,
  stackedBarChartSchema,
  sunburstChartSchema,
  treemapChartSchema,
} from '@texuli/charts/schemas';
import type { Component } from 'svelte';
import { describe, expect, it } from 'vitest';
import type CalendarHeatmap from '../src/calendar/CalendarHeatmap.svelte';
import type AreaChart from '../src/cartesian/AreaChart.svelte';
import type BarChart from '../src/cartesian/BarChart.svelte';
import type ComboChart from '../src/cartesian/ComboChart.svelte';
import type LineChart from '../src/cartesian/LineChart.svelte';
import type StackedBarChart from '../src/cartesian/StackedBarChart.svelte';
import type BulletChart from '../src/compact/BulletChart.svelte';
import type Gauge from '../src/compact/Gauge.svelte';
import type ProgressRing from '../src/compact/ProgressRing.svelte';
import type Sparkline from '../src/compact/Sparkline.svelte';
import type FunnelChart from '../src/flow/FunnelChart.svelte';
import type NetworkGraph from '../src/flow/NetworkGraph.svelte';
import type SankeyChart from '../src/flow/SankeyChart.svelte';
import type GeoMap from '../src/geo/GeoMap.svelte';
import type GeoPointMap from '../src/geo/GeoPointMap.svelte';
import type HistogramChart from '../src/histogram/HistogramChart.svelte';
import type BubbleChart from '../src/matrix/BubbleChart.svelte';
import type HeatmapChart from '../src/matrix/HeatmapChart.svelte';
import type ScatterChart from '../src/matrix/ScatterChart.svelte';
import type PackChart from '../src/pack/PackChart.svelte';
import type DonutChart from '../src/part-whole/DonutChart.svelte';
import type PieChart from '../src/part-whole/PieChart.svelte';
import type SunburstChart from '../src/part-whole/SunburstChart.svelte';
import type TreemapChart from '../src/part-whole/TreemapChart.svelte';

type PropNames<Schema extends ChartComponentPropSchema> = Schema['props'][number]['name'];
type PropsFor<ComponentType> = ComponentType extends Component<infer Props> ? Props : never;
type IsAny<Value> = 0 extends 1 & Value ? true : false;
type PublicProps<ComponentType> = Extract<keyof PropsFor<ComponentType>, string>;
type RequiredProps<ComponentType> = Extract<
  {
    [Key in keyof PropsFor<ComponentType>]-?: object extends Pick<PropsFor<ComponentType>, Key>
      ? never
      : Key;
  }[keyof PropsFor<ComponentType>],
  string
>;
type RequiredSchemaProps<Schema extends ChartComponentPropSchema> =
  Schema['props'][number] extends infer Field
    ? Field extends { readonly name: infer Name extends string; readonly required: true }
      ? Name
      : never
    : never;
type Same<A, B> = [Exclude<A, B>, Exclude<B, A>] extends [never, never] ? true : false;
type SchemaMatches<ComponentType, Schema extends ChartComponentPropSchema> =
  IsAny<PropsFor<ComponentType>> extends true
    ? true
    : string extends keyof PropsFor<ComponentType>
      ? true
      : Same<PublicProps<ComponentType>, PropNames<Schema>> extends true
        ? Same<RequiredProps<ComponentType>, RequiredSchemaProps<Schema>>
        : false;
type Assert<T extends true> = T;

type PropCoverage = [
  Assert<SchemaMatches<typeof LineChart, typeof lineChartSchema>>,
  Assert<SchemaMatches<typeof AreaChart, typeof areaChartSchema>>,
  Assert<SchemaMatches<typeof BarChart, typeof barChartSchema>>,
  Assert<SchemaMatches<typeof StackedBarChart, typeof stackedBarChartSchema>>,
  Assert<SchemaMatches<typeof ComboChart, typeof comboChartSchema>>,
  Assert<SchemaMatches<typeof PieChart, typeof pieChartSchema>>,
  Assert<SchemaMatches<typeof DonutChart, typeof donutChartSchema>>,
  Assert<SchemaMatches<typeof SunburstChart, typeof sunburstChartSchema>>,
  Assert<SchemaMatches<typeof TreemapChart, typeof treemapChartSchema>>,
  Assert<SchemaMatches<typeof HeatmapChart, typeof heatmapChartSchema>>,
  Assert<SchemaMatches<typeof ScatterChart, typeof scatterChartSchema>>,
  Assert<SchemaMatches<typeof BubbleChart, typeof bubbleChartSchema>>,
  Assert<SchemaMatches<typeof Sparkline, typeof sparklineSchema>>,
  Assert<SchemaMatches<typeof BulletChart, typeof bulletChartSchema>>,
  Assert<SchemaMatches<typeof Gauge, typeof gaugeSchema>>,
  Assert<SchemaMatches<typeof ProgressRing, typeof progressRingSchema>>,
  Assert<SchemaMatches<typeof FunnelChart, typeof funnelChartSchema>>,
  Assert<SchemaMatches<typeof SankeyChart, typeof sankeyChartSchema>>,
  Assert<SchemaMatches<typeof NetworkGraph, typeof networkGraphSchema>>,
  Assert<SchemaMatches<typeof GeoMap, typeof geoMapSchema>>,
  Assert<SchemaMatches<typeof GeoPointMap, typeof geoPointMapSchema>>,
  Assert<SchemaMatches<typeof HistogramChart, typeof histogramChartSchema>>,
  Assert<SchemaMatches<typeof PackChart, typeof packChartSchema>>,
  Assert<SchemaMatches<typeof CalendarHeatmap, typeof calendarHeatmapSchema>>,
];

const checkedComponentCount: PropCoverage['length'] = 24;

function propValue(schemaId: keyof typeof chartPropSchemas, name: string): ChartValueSchema {
  const field = chartPropSchemas[schemaId].props.find((item) => item.name === name);
  if (!field) throw new Error(`${schemaId} is missing ${name}.`);
  return field;
}

function assertNodeIsInspectable(node: ChartValueSchema): void {
  if (node.kind === 'array') assertNodeIsInspectable(node.items);
  if (node.kind === 'tuple') node.items.forEach(assertNodeIsInspectable);
  if (node.kind === 'nullable') assertNodeIsInspectable(node.value);
  if (node.kind === 'union') node.variants.forEach(assertNodeIsInspectable);
  if (node.kind === 'record') assertNodeIsInspectable(node.values);
  if (node.kind === 'reference') {
    expect((chartSchemaDefinitions as Record<string, ChartValueSchema>)[node.ref]).toBeDefined();
  }
  if (node.kind === 'object') {
    const names = node.properties.map((field) => field.name);
    expect(new Set(names).size).toBe(names.length);
    for (const field of node.properties) {
      expect(field.label).not.toBe('');
      expect(field.description).not.toBe('');
      assertNodeIsInspectable(field);
    }
    if (node.additionalProperties) {
      assertNodeIsInspectable(node.additionalProperties);
    }
  }
}

function assertPlainJson(value: unknown): asserts value is ChartSchemaJson {
  if (value === null || ['boolean', 'number', 'string'].includes(typeof value)) return;
  expect(typeof value).toBe('object');
  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    assertPlainJson(nestedValue);
  }
}

describe('chart prop schemas', () => {
  it('covers every blueprint-rendered chart and every chart family, and 5 related cases', () => {
    // covers every blueprint-rendered chart and every chart family
    expect(checkedComponentCount).toBe(24);
    expect(Object.keys(chartPropSchemas)).toHaveLength(24);
    expect(new Set(Object.values(chartPropSchemas).map((schema) => schema.family))).toEqual(
      new Set([
        'cartesian',
        'part-whole',
        'matrix',
        'compact',
        'flow',
        'geo',
        'histogram',
        'pack',
        'calendar',
      ])
    );
    for (const [id, schema] of Object.entries(chartPropSchemas)) {
      expect(schema.id).toBe(id);
      expect(schema.schemaVersion).toBe(1);
      expect(schema.component).toMatch(/^[A-Z]/);
      const names = schema.props.map((field) => field.name);
      expect(new Set(names).size).toBe(names.length);
    }
    {
      // is plain JSON with no runtime values hidden in defaults or nested schemas
      const bundle = { definitions: chartSchemaDefinitions, components: chartPropSchemas };
      assertPlainJson(bundle);
      expect(JSON.parse(JSON.stringify(bundle))).toEqual(bundle);
      for (const schema of Object.values(chartPropSchemas)) {
        for (const field of schema.props) {
          expect(field.label).not.toBe('');
          expect(field.description).not.toBe('');
          assertNodeIsInspectable(field);
        }
      }
      Object.values(chartSchemaDefinitions).forEach(assertNodeIsInspectable);
    }
    {
      // describes nested series, axes, bins, records, and recursive layouts
      const series = propValue('charts-line', 'series');
      expect(series.kind).toBe('array');
      expect(series.kind === 'array' && series.items.kind).toBe('object');
      const seriesObject =
        series.kind === 'array' ? (series.items as ChartObjectSchema) : undefined;
      const points = seriesObject?.properties.find((field) => field.name === 'points');
      expect(points?.kind).toBe('array');
      expect(propValue('charts-line', 'fullDomain')).toMatchObject({
        kind: 'tuple',
        items: [
          { kind: 'number', constraints: { finite: true } },
          { kind: 'number', constraints: { finite: true } },
        ],
      });
      expect(propValue('charts-line', 'visibleDomain')).toMatchObject({
        kind: 'tuple',
        items: [
          { kind: 'number', constraints: { finite: true } },
          { kind: 'number', constraints: { finite: true } },
        ],
      });

      const annotations = propValue('charts-line', 'annotations');
      expect(annotations).toMatchObject({
        kind: 'array',
        constraints: { uniqueBy: 'id', maxItems: 100 },
        items: {
          kind: 'union',
          variants: [
            { kind: 'object' },
            { kind: 'object' },
            { kind: 'object' },
            { kind: 'object' },
            { kind: 'object' },
          ],
        },
      });
      expect(propValue('charts-heatmap', 'annotations')).toMatchObject({
        kind: 'array',
        constraints: { uniqueBy: 'id', maxItems: 100 },
      });

      expect(propValue('charts-histogram', 'thresholds').kind).toBe('array');
      expect(propValue('charts-histogram', 'binCount')).toMatchObject({
        kind: 'number',
        constraints: { integer: true, minimum: 1 },
      });
      expect(propValue('charts-calendar', 'values').kind).toBe('record');
      expect(propValue('charts-pack', 'root')).toMatchObject({
        kind: 'reference',
        ref: 'tree-node',
      });
      expect(chartSchemaDefinitions['tree-node']).toMatchObject({ kind: 'object' });
    }
    // describes compact chart formatting as inspectable JSON rather than a callback event
    for (const id of [
      'charts-sparkline',
      'charts-bullet',
      'charts-gauge',
      'charts-progress-ring',
    ] as const) {
      const format = propValue(id, 'format');
      expect(format.kind).toBe('union');
      if (format.kind !== 'union') continue;
      expect(format.variants).toHaveLength(2);
      expect(format.variants.map((variant) => variant.kind)).toEqual(['object', 'object']);
      const fields = format.variants.map((variant) =>
        variant.kind === 'object' ? variant.properties.map((field) => field.name) : []
      );
      expect(fields[0]).toContain('currency');
      expect(fields[1]).toContain('timeZone');
    }
    {
      // exposes editable object fields inside series, points, cells, and thresholds
      const asObject = (value: ChartValueSchema): ChartObjectSchema => {
        expect(value.kind).toBe('object');
        if (value.kind !== 'object') throw new Error('Expected an object schema.');
        return value;
      };
      const arrayItems = (schemaId: keyof typeof chartPropSchemas, name: string) => {
        const value = propValue(schemaId, name);
        expect(value.kind).toBe('array');
        if (value.kind !== 'array') throw new Error(`Expected ${name} to be an array schema.`);
        return value.items;
      };
      const fieldNames = (value: ChartValueSchema) =>
        asObject(value).properties.map((field) => field.name);

      const series = asObject(arrayItems('charts-line', 'series'));
      expect(fieldNames(series)).toEqual(
        expect.arrayContaining(['id', 'label', 'points', 'color'])
      );

      const points = series.properties.find((field) => field.name === 'points');
      expect(points?.kind).toBe('array');
      if (points?.kind !== 'array') throw new Error('Expected series points to be an array.');
      expect(fieldNames(points.items)).toEqual(expect.arrayContaining(['x', 'y']));

      expect(fieldNames(arrayItems('charts-heatmap', 'cells'))).toEqual(
        expect.arrayContaining(['x', 'y', 'value'])
      );
      expect(arrayItems('charts-histogram', 'thresholds')).toMatchObject({
        kind: 'number',
        constraints: { finite: true },
      });
      expect(arrayItems('charts-gauge', 'thresholds')).toMatchObject({
        kind: 'number',
        constraints: { finite: true },
      });
    }
    {
      // publishes component defaults and marks callbacks as developer-only
      const defaultFor = (id: keyof typeof chartPropSchemas, name: string) =>
        chartPropSchemas[id].props.find((field) => field.name === name)?.default;

      expect(defaultFor('charts-line', 'renderer')).toBe('auto');
      expect(defaultFor('charts-donut', 'innerRatio')).toBe(0.58);
      expect(defaultFor('charts-gauge', 'size')).toBe(144);
      expect(defaultFor('charts-funnel', 'orientation')).toBe('vertical');
      expect(defaultFor('charts-histogram', 'width')).toBe(640);
      expect(defaultFor('charts-calendar', 'weekStartsOn')).toBe(1);

      const callbacks = Object.values(chartPropSchemas).flatMap((schema) =>
        schema.props.filter((field) => field.kind === 'event')
      );
      expect(callbacks.length).toBeGreaterThan(0);
      expect(callbacks.every((field) => field.exposure === 'developer')).toBe(true);
    }
  });
});
