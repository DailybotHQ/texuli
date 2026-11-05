<script lang="ts">
import type { CodeBlockViewProps } from '@texuli/blocks/code';
import type { DataBlockViewProps } from '@texuli/blocks/data';
import type { DiagramBlockViewProps } from '@texuli/blocks/diagram';
import type { EmbedBlockViewProps } from '@texuli/blocks/embed';
import type { InteractiveBlockViewProps } from '@texuli/blocks/interactive/engine';
import type { MapBlockViewProps } from '@texuli/blocks/map/engine';
import type { MediaBlockViewProps } from '@texuli/blocks/media';
import type { StructureBlockViewProps } from '@texuli/blocks/structure/engine';
import type { TextBlockViewProps } from '@texuli/blocks/text';
import type { CanvasRenderer } from '@texuli/charts/canvas';
import type {
  AreaChart,
  BarChart,
  CartesianChart,
  ComboChart,
  LineChart,
  StackedBarChart,
} from '@texuli/charts/cartesian';
import type { BulletChart, Gauge, ProgressRing, Sparkline } from '@texuli/charts/compact';
import type { FunnelChart, NetworkGraph, SankeyChart } from '@texuli/charts/flow';
import type { GeoMap, GeoPointMap } from '@texuli/charts/geo';
import type { BubbleChart, HeatmapChart, ScatterChart } from '@texuli/charts/matrix';
import type { DonutChart, PieChart, SunburstChart, TreemapChart } from '@texuli/charts/part-whole';
import type { CompositionCanvas } from '@texuli/media/composition-canvas';
import type { CompositionSvg } from '@texuli/media/composition-svg';
import type { Image } from '@texuli/media/image';
import type { ComponentProps } from 'svelte';
import { CONTENT_PROP_NAMES } from '../src/manifests/content/prop-names.ts';

type ComponentPropsById = {
  'blocks-text': TextBlockViewProps;
  'blocks-data': DataBlockViewProps;
  'blocks-diagram': DiagramBlockViewProps;
  'blocks-media': MediaBlockViewProps;
  'blocks-embed': EmbedBlockViewProps;
  'blocks-structure': StructureBlockViewProps;
  'blocks-code': CodeBlockViewProps;
  'blocks-interactive': InteractiveBlockViewProps;
  'blocks-map': MapBlockViewProps;
  'charts-area': ComponentProps<typeof AreaChart>;
  'charts-bar': ComponentProps<typeof BarChart>;
  'charts-cartesian': ComponentProps<typeof CartesianChart>;
  'charts-combo': ComponentProps<typeof ComboChart>;
  'charts-line': ComponentProps<typeof LineChart>;
  'charts-stacked-bar': ComponentProps<typeof StackedBarChart>;
  'charts-bullet': ComponentProps<typeof BulletChart>;
  'charts-gauge': ComponentProps<typeof Gauge>;
  'charts-progress-ring': ComponentProps<typeof ProgressRing>;
  'charts-sparkline': ComponentProps<typeof Sparkline>;
  'charts-canvas-renderer': ComponentProps<typeof CanvasRenderer>;
  'charts-funnel': ComponentProps<typeof FunnelChart>;
  'charts-network': ComponentProps<typeof NetworkGraph>;
  'charts-sankey': ComponentProps<typeof SankeyChart>;
  'charts-geo-map': ComponentProps<typeof GeoMap>;
  'charts-geo-point-map': ComponentProps<typeof GeoPointMap>;
  'charts-bubble': ComponentProps<typeof BubbleChart>;
  'charts-heatmap': ComponentProps<typeof HeatmapChart>;
  'charts-scatter': ComponentProps<typeof ScatterChart>;
  'charts-donut': ComponentProps<typeof DonutChart>;
  'charts-pie': ComponentProps<typeof PieChart>;
  'charts-sunburst': ComponentProps<typeof SunburstChart>;
  'charts-treemap': ComponentProps<typeof TreemapChart>;
  'media-image': ComponentProps<typeof Image>;
  'media-composition-svg': ComponentProps<typeof CompositionSvg>;
  'media-composition-canvas': ComponentProps<typeof CompositionCanvas>;
};

type Assert<Condition extends never> = Condition;
// Host callbacks (onzoom, onselect…) are never agent-settable data, so manifests omit them.
type DataKeys<T> = {
  // biome-ignore lint/suspicious/noExplicitAny: matches any function signature
  [K in keyof T]-?: NonNullable<T[K]> extends (...args: any[]) => any ? never : K;
}[keyof T];
type ComponentPropsMissingFromSchema = {
  [Id in keyof ComponentPropsById]: Exclude<
    DataKeys<ComponentPropsById[Id]>,
    (typeof CONTENT_PROP_NAMES)[Id][number]
  > extends never
    ? never
    : Id;
}[keyof ComponentPropsById];
type SchemaPropsMissingFromComponent = {
  [Id in keyof ComponentPropsById]: Exclude<
    (typeof CONTENT_PROP_NAMES)[Id][number],
    keyof ComponentPropsById[Id]
  > extends never
    ? never
    : Id;
}[keyof ComponentPropsById];
type EveryComponentPropMatchesItsManifest = [
  Assert<ComponentPropsMissingFromSchema>,
  Assert<SchemaPropsMissingFromComponent>,
];

const compileTimeProof: EveryComponentPropMatchesItsManifest | undefined = undefined;
void compileTimeProof;
</script>
