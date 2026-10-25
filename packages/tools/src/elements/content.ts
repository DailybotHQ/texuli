import { buildCatalog } from '@texuli/catalog/build';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import {
  type RenderCatalog,
  type RenderComponentSpec,
  renderCatalogFromBuild,
} from '@texuli/catalog/render/renderer';
import type { Component } from 'svelte';

/**
 * The content preset (T-tool-elements): one lazy loader per catalog content
 * component (blocks, charts, media), and the render catalog of their
 * manifests. Each loader is its own dynamic import, so a page pays only for
 * the components its trees use.
 */

// biome-ignore lint/suspicious/noExplicitAny: element props are validated data, typed per component by its manifest.
export type ElementComponent = Component<any>;
export type ElementComponentLoader = () => Promise<ElementComponent>;

export const CONTENT_ELEMENT_LOADERS: Readonly<Record<string, ElementComponentLoader>> =
  Object.freeze({
    'blocks-text': async () =>
      (await (await import('@texuli/blocks/text')).loadTextFamily()).default,
    'blocks-data': async () =>
      (await (await import('@texuli/blocks/data')).loadDataFamily()).default,
    'blocks-diagram': async () =>
      (await (await import('@texuli/blocks/diagram')).loadDiagramFamily()).default,
    'blocks-media': async () =>
      (await (await import('@texuli/blocks/media')).loadMediaFamily()).default,
    'blocks-embed': async () =>
      (await (await import('@texuli/blocks/embed')).loadEmbedFamily()).default,
    'blocks-structure': async () =>
      (await (await import('@texuli/blocks/structure')).loadStructureFamily()).default,
    'blocks-code': async () =>
      (await (await import('@texuli/blocks/code')).loadCodeFamily()).default,
    'blocks-interactive': async () =>
      (await (await import('@texuli/blocks/interactive')).loadInteractiveFamily()).default,
    'blocks-map': async () => (await (await import('@texuli/blocks/map')).loadMapFamily()).default,
    'charts-area': async () => (await import('@texuli/charts/cartesian')).AreaChart,
    'charts-bar': async () => (await import('@texuli/charts/cartesian')).BarChart,
    'charts-cartesian': async () => (await import('@texuli/charts/cartesian')).CartesianChart,
    'charts-combo': async () => (await import('@texuli/charts/cartesian')).ComboChart,
    'charts-line': async () => (await import('@texuli/charts/cartesian')).LineChart,
    'charts-stacked-bar': async () => (await import('@texuli/charts/cartesian')).StackedBarChart,
    'charts-bullet': async () => (await import('@texuli/charts/compact')).BulletChart,
    'charts-gauge': async () => (await import('@texuli/charts/compact')).Gauge,
    'charts-progress-ring': async () => (await import('@texuli/charts/compact')).ProgressRing,
    'charts-sparkline': async () => (await import('@texuli/charts/compact')).Sparkline,
    'charts-canvas-renderer': async () => (await import('@texuli/charts/canvas')).CanvasRenderer,
    'charts-funnel': async () => (await import('@texuli/charts/flow')).FunnelChart,
    'charts-network': async () => (await import('@texuli/charts/flow')).NetworkGraph,
    'charts-sankey': async () => (await import('@texuli/charts/flow')).SankeyChart,
    'charts-geo-map': async () => (await import('@texuli/charts/geo')).GeoMap,
    'charts-geo-point-map': async () => (await import('@texuli/charts/geo')).GeoPointMap,
    'charts-bubble': async () => (await import('@texuli/charts/matrix')).BubbleChart,
    'charts-heatmap': async () => (await import('@texuli/charts/matrix')).HeatmapChart,
    'charts-scatter': async () => (await import('@texuli/charts/matrix')).ScatterChart,
    'charts-donut': async () => (await import('@texuli/charts/part-whole')).DonutChart,
    'charts-pie': async () => (await import('@texuli/charts/part-whole')).PieChart,
    'charts-sunburst': async () => (await import('@texuli/charts/part-whole')).SunburstChart,
    'charts-treemap': async () => (await import('@texuli/charts/part-whole')).TreemapChart,
    'media-image': async () => (await import('@texuli/media/image')).Image,
    'media-composition-svg': async () =>
      (await import('@texuli/media/composition-svg')).CompositionSvg,
    'media-composition-canvas': async () =>
      (await import('@texuli/media/composition-canvas')).CompositionCanvas,
  } satisfies Record<string, ElementComponentLoader>);

/** Render specs of the content manifests (labels, prop schemas, emit tiers). */
export function contentRenderSpecs(): RenderComponentSpec[] {
  return CONTENT_MANIFESTS.map((manifest) => ({
    id: manifest.id,
    label: manifest.label,
    props: manifest.props,
    agentEmittable: manifest.agentEmittable === true,
    emit: manifest.agentEmittable === true ? ['developer', 'untrusted'] : [],
  }));
}

/** The render catalog the content elements validate trees against. */
export function contentRenderCatalog(): RenderCatalog {
  return renderCatalogFromBuild(CONTENT_CATALOG_BUILD.catalog);
}

const CONTENT_CATALOG_BUILD = await buildCatalog([
  { name: 'content', manifests: CONTENT_MANIFESTS },
]);
