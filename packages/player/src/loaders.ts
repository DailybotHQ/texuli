import type { PlayerLoader } from '@texuli/catalog/player';

/**
 * Lazy id-to-component map for the Phase 0 content player. Imports stay
 * behind the id loader so a blueprint only loads the families it paints.
 */
export const PLAYER_LOADERS: Readonly<Record<string, PlayerLoader>> = Object.freeze({
  'layout-card': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'layout-page': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'layout-doc': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'layout-grid': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'layout-stack': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'layout-row': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'layout-split': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'layout-tile': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'control-toggle': async () => (await import('./controls/ToggleControl.svelte')).default,
  'control-choice': async () => (await import('./controls/ChoiceControl.svelte')).default,
  'control-slider': async () => (await import('./controls/SliderControl.svelte')).default,
  'control-filter': async () => (await import('./controls/FilterControl.svelte')).default,
  'host-region': async () => (await import('./HostRegion.svelte')).default,

  'flow-view': async () => (await import('./flow/FlowView.svelte')).default,
  'flow-action': async () => (await import('./flow/FlowAction.svelte')).default,
  'action-form': async () => (await import('./actions/ActionForm.svelte')).default,
  'form-field': async () => (await import('./actions/FormField.svelte')).default,
  'form-submit': async () => (await import('./actions/FormSubmit.svelte')).default,
  'layout-deck': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'deck-slide': async () => (await import('./layouts/ContentLayout.svelte')).default,
  'blocks-text': async () =>
    (await import('@texuli/blocks/text')).loadTextFamily().then((m) => m.default),
  'blocks-data': async () =>
    (await import('@texuli/blocks/data')).loadDataFamily().then((m) => m.default),
  'blocks-diagram': async () =>
    (await import('@texuli/blocks/diagram')).loadDiagramFamily().then((m) => m.default),
  'blocks-media': async () =>
    (await import('@texuli/blocks/media')).loadMediaFamily().then((m) => m.default),
  'blocks-embed': async () =>
    (await import('@texuli/blocks/embed')).loadEmbedFamily().then((m) => m.default),
  'blocks-structure': async () =>
    (await import('@texuli/blocks/structure')).loadStructureFamily().then((m) => m.default),
  'blocks-code': async () =>
    (await import('@texuli/blocks/code')).loadCodeFamily().then((m) => m.default),
  'blocks-interactive': async () =>
    (await import('@texuli/blocks/interactive')).loadInteractiveFamily().then((m) => m.default),
  'blocks-map': async () =>
    (await import('@texuli/blocks/map')).loadMapFamily().then((m) => m.default),
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
  // Spec 0.3.0: data views, chat, drag as data and workflows, through the player's painters.
  'data-board': async () => (await import('./painters/DataBoardPainter.svelte')).default,
  'data-tree-view': async () => (await import('./painters/DataTreeViewPainter.svelte')).default,
  'data-calendar': async () => (await import('./painters/DataCalendarPainter.svelte')).default,
  'data-grid': async () => (await import('./painters/DataGridPainter.svelte')).default,
  'data-files': async () => (await import('./painters/DataFilesPainter.svelte')).default,
  'data-map': async () => (await import('./painters/DataMapPainter.svelte')).default,
  'data-timeline': async () => (await import('./painters/DataTimelinePainter.svelte')).default,
  'chat-thread': async () => (await import('@texuli/chat')).ChatThreadDisplay,
  'chat-message': async () => (await import('@texuli/chat')).ChatMessageDisplay,
  'sortable-list': async () => (await import('./painters/SortableListPainter.svelte')).default,
  'workflow-graph': async () => (await import('./painters/WorkflowGraphPainter.svelte')).default,
});
