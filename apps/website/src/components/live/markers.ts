/**
 * Expected root marker inside each live stage for e2e identity checks.
 * Prefer the component's own data-tx-* when it ships one; otherwise a
 * family wrapper data-tx-live-component="{id}" that only wraps that component.
 */
export type LiveMarkerSpec = {
  /** CSS selector scoped under [data-tx-live-stage="{id}"]. */
  marker: string;
  /** Click target for one interaction (optional). */
  interact?: string;
};

/** Every catalog id must appear here. */
export const LIVE_MARKERS: Readonly<Record<string, LiveMarkerSpec>> = {
  alert: { marker: '[data-tx-alert]', interact: 'button' },
  'alert-dialog': {
    marker: '[data-tx-dialog], [data-tx-alert-dialog], [data-tx-live-component="alert-dialog"]',
    interact: 'button',
  },
  'analytics-grid': { marker: '[data-tx-live-component="analytics-grid"]' },
  'app-nav': {
    marker: '[data-tx-app-nav], [data-tx-live-component="app-nav"]',
    interact: 'button',
  },
  badge: { marker: '[data-tx-badge]' },
  banner: { marker: '[data-tx-alert][data-tx-layout="banner"]' },
  'blocks-data': { marker: '[data-tx-live-component="blocks-data"]' },
  'blocks-diagram': { marker: '[data-tx-live-component="blocks-diagram"]' },
  'blocks-embed': { marker: '[data-tx-live-component="blocks-embed"]' },
  'blocks-media': { marker: '[data-tx-live-component="blocks-media"]' },
  'blocks-text': { marker: '[data-tx-live-component="blocks-text"]' },
  'blocks-structure': { marker: '[data-tx-live-component="blocks-structure"]' },
  'blocks-code': { marker: '[data-tx-live-component="blocks-code"]' },
  'blocks-interactive': { marker: '[data-tx-live-component="blocks-interactive"]' },
  'blocks-map': { marker: '[data-tx-live-component="blocks-map"]' },
  breadcrumb: { marker: '[data-tx-breadcrumb]' },
  button: {
    marker:
      '[data-tx-button], button[data-tx-button], button.tx-button, [data-tx-live-component="button"] button',
  },
  'button-group': { marker: '[data-tx-button-group], [data-tx-live-component="button-group"]' },
  callout: { marker: '[data-tx-alert][data-tx-layout="callout"]' },
  card: { marker: '[data-tx-card]' },
  'charts-area': {
    marker: '[data-tx-live-component="charts-area"] svg, [data-tx-live-component="charts-area"]',
  },
  'charts-bar': {
    marker: '[data-tx-live-component="charts-bar"] svg, [data-tx-live-component="charts-bar"]',
  },
  'charts-bubble': { marker: '[data-tx-live-component="charts-bubble"] svg, [data-tx-matrix]' },
  'charts-bullet': { marker: '[data-tx-live-component="charts-bullet"]' },
  'charts-canvas-renderer': {
    marker:
      '[data-tx-live-component="charts-canvas-renderer"] canvas, [data-tx-live-component="charts-canvas-renderer"]',
  },
  'charts-cartesian': {
    marker:
      '[data-tx-live-component="charts-cartesian"] svg, [data-tx-live-component="charts-cartesian"]',
  },
  'charts-combo': {
    marker: '[data-tx-live-component="charts-combo"] svg, [data-tx-live-component="charts-combo"]',
  },
  'charts-donut': {
    marker: '[data-tx-live-component="charts-donut"] svg, [data-tx-live-component="charts-donut"]',
  },
  'charts-funnel': { marker: '[data-tx-live-component="charts-funnel"]' },
  'charts-gauge': { marker: '[data-tx-live-component="charts-gauge"]' },
  'charts-geo-map': { marker: '[data-tx-live-component="charts-geo-map"]' },
  'charts-geo-point-map': { marker: '[data-tx-live-component="charts-geo-point-map"]' },
  'charts-heatmap': { marker: '[data-tx-live-component="charts-heatmap"] svg, [data-tx-matrix]' },
  'charts-line': {
    marker: '[data-tx-live-component="charts-line"] svg, [data-tx-live-component="charts-line"]',
  },
  'charts-network': { marker: '[data-tx-live-component="charts-network"]' },
  'charts-pie': {
    marker: '[data-tx-live-component="charts-pie"] svg, [data-tx-live-component="charts-pie"]',
  },
  'charts-progress-ring': { marker: '[data-tx-live-component="charts-progress-ring"]' },
  'charts-sankey': { marker: '[data-tx-live-component="charts-sankey"]' },
  'charts-scatter': { marker: '[data-tx-live-component="charts-scatter"] svg, [data-tx-matrix]' },
  'charts-sparkline': { marker: '[data-tx-live-component="charts-sparkline"]' },
  'charts-stacked-bar': {
    marker:
      '[data-tx-live-component="charts-stacked-bar"] svg, [data-tx-live-component="charts-stacked-bar"]',
  },
  'charts-sunburst': { marker: '[data-tx-live-component="charts-sunburst"]' },
  'charts-treemap': { marker: '[data-tx-live-component="charts-treemap"]' },
  checkbox: {
    marker: '[data-tx-choice="checkbox"], [data-tx-checkbox], button[role="checkbox"]',
    interact: 'button',
  },
  chip: { marker: '[data-tx-chip]', interact: 'button' },
  code: { marker: '[data-tx-code]' },
  combobox: { marker: '[data-tx-live-component="combobox"]' },
  'command-palette': { marker: '[data-tx-live-component="command-palette"]', interact: 'button' },
  'content-layout': { marker: '[data-tx-layout-host], [data-tx-live-component="content-layout"]' },
  'context-menu': {
    marker: '[data-tx-live-component="context-menu"]',
    interact: 'button, [data-tx-context-menu-trigger], [data-tx-menu-trigger]',
  },
  'context-menu-trigger': { marker: '[data-tx-live-component="context-menu-trigger"]' },
  'deck-slide': { marker: '[data-tx-live-component="deck-slide"]' },
  description: { marker: '[data-tx-description]' },
  'detail-panel': {
    marker: '[data-tx-sheet], [data-tx-live-component="detail-panel"]',
    interact: 'button',
  },
  dialog: { marker: '[data-tx-dialog], [data-tx-live-component="dialog"]', interact: 'button' },
  drawer: { marker: '[data-tx-sheet], [data-tx-live-component="drawer"]', interact: 'button' },
  'dropdown-menu': { marker: '[data-tx-live-component="dropdown-menu"]', interact: 'button' },
  'dropdown-menu-content': { marker: '[data-tx-live-component="dropdown-menu-content"]' },
  'dropdown-menu-item': { marker: '[data-tx-live-component="dropdown-menu-item"]' },
  'dropdown-menu-trigger': { marker: '[data-tx-live-component="dropdown-menu-trigger"]' },
  'empty-state': { marker: '[data-tx-empty]' },
  'error-state': { marker: '[data-tx-error]' },
  field: { marker: '[data-tx-field], [data-tx-live-component="field"]' },
  'field-error': { marker: '[data-tx-live-component="field-error"]' },
  form: { marker: '[data-tx-live-component="form"], form' },
  'hover-card': { marker: '[data-tx-live-component="hover-card"]', interact: 'button' },
  'hover-card-content': { marker: '[data-tx-live-component="hover-card-content"]' },
  'icon-button': { marker: '[data-tx-button], button[aria-label]', interact: 'button' },
  'inline-text': { marker: '[data-tx-live-component="inline-text"]' },
  input: { marker: '[data-tx-input], input', interact: 'input' },
  'input-group': { marker: '[data-tx-input-group], [data-tx-live-component="input-group"]' },
  kbd: { marker: '[data-tx-kbd]' },
  kpi: { marker: '[data-tx-kpi], [data-tx-live-component="kpi"]' },
  label: { marker: '[data-tx-label]' },
  'layout-auth-split': {
    marker:
      '[data-tx-layout-host][data-layout="auth-split"], [data-tx-live-component="layout-auth-split"]',
  },
  'layout-blog': { marker: '[data-tx-layout-host], [data-tx-live-component="layout-blog"]' },
  'layout-card': { marker: '[data-tx-card], [data-tx-live-component="layout-card"]' },
  'layout-chrome': { marker: '[data-tx-live-component="layout-chrome"]' },
  'layout-dashboard-grid': {
    marker: '[data-tx-layout-host], [data-tx-live-component="layout-dashboard-grid"]',
  },
  'layout-deck': { marker: '[data-tx-live-component="layout-deck"]' },
  'layout-doc': { marker: '[data-tx-live-component="layout-doc"]' },
  'layout-docs': { marker: '[data-tx-layout-host], [data-tx-live-component="layout-docs"]' },
  'layout-drawer': { marker: '[data-tx-live-component="layout-drawer"]', interact: 'button' },
  'layout-dual-sidebar': {
    marker:
      '[data-tx-layout-host][data-layout="dual-sidebar"], [data-tx-live-component="layout-dual-sidebar"]',
  },
  'layout-editorial': {
    marker: '[data-tx-layout-host], [data-tx-live-component="layout-editorial"]',
  },
  'layout-grid': { marker: '[data-tx-live-component="layout-grid"]' },
  'layout-host': { marker: '[data-tx-layout-host], [data-tx-live-component="layout-host"]' },
  'layout-landing': { marker: '[data-tx-live-component="layout-landing"]' },
  'layout-marketing': {
    marker: '[data-tx-layout-host], [data-tx-live-component="layout-marketing"]',
  },
  'layout-page': { marker: '[data-tx-live-component="layout-page"]' },
  'layout-pricing': { marker: '[data-tx-live-component="layout-pricing"]' },
  'layout-settings': { marker: '[data-tx-live-component="layout-settings"]' },
  'layout-sidebar': {
    marker:
      '[data-tx-layout-host][data-layout="sidebar"], [data-tx-live-component="layout-sidebar"]',
  },
  'layout-top-nav': {
    marker:
      '[data-tx-layout-host][data-layout="top-nav"], [data-tx-live-component="layout-top-nav"]',
  },
  'layout-wizard': { marker: '[data-tx-layout-host], [data-tx-live-component="layout-wizard"]' },
  'media-composition-canvas': { marker: '[data-tx-live-component="media-composition-canvas"]' },
  'media-composition-svg': { marker: '[data-tx-live-component="media-composition-svg"]' },
  'media-image': { marker: '[data-tx-live-component="media-image"] img, [data-tx-image], img' },
  menubar: { marker: '[data-tx-live-component="menubar"]', interact: 'button' },
  'menubar-trigger': { marker: '[data-tx-live-component="menubar-trigger"]' },
  'multi-select': { marker: '[data-tx-live-component="multi-select"]' },
  'nav-icon': { marker: '[data-tx-live-component="nav-icon"], [data-tx-icon]' },
  'navigation-menu': { marker: '[data-tx-live-component="navigation-menu"]' },
  pagination: { marker: '[data-tx-live-component="pagination"], nav[aria-label="Pagination"]' },
  popover: { marker: '[data-tx-live-component="popover"]', interact: 'button' },
  'popover-content': { marker: '[data-tx-live-component="popover-content"]' },
  radio: { marker: '[data-tx-choice="radio"], button[role="radio"]', interact: 'button' },
  'radio-group': {
    marker: '[data-tx-choice="radio-group"], [data-tx-live-component="radio-group"]',
  },
  'responsive-modal': {
    marker: '[data-tx-sheet], [data-tx-live-component="responsive-modal"]',
    interact: 'button',
  },
  'screen-outlet': { marker: '[data-tx-layout-screen], [data-tx-live-component="screen-outlet"]' },
  select: {
    marker: '[data-tx-select-trigger], [data-tx-live-component="select"]',
    interact: 'button',
  },
  'select-content': { marker: '[data-tx-live-component="select-content"]' },
  'select-group': { marker: '[data-tx-live-component="select-group"]' },
  'select-item': { marker: '[data-tx-live-component="select-item"]' },
  'select-label': { marker: '[data-tx-live-component="select-label"]' },
  'select-portal': { marker: '[data-tx-live-component="select-portal"]' },
  'select-separator': { marker: '[data-tx-live-component="select-separator"]' },
  'select-trigger': { marker: '[data-tx-live-component="select-trigger"]' },
  'select-value': { marker: '[data-tx-live-component="select-value"]' },
  'select-viewport': { marker: '[data-tx-live-component="select-viewport"]' },
  sheet: { marker: '[data-tx-sheet], [data-tx-live-component="sheet"]', interact: 'button' },
  sidebar: { marker: '[data-tx-sidebar], [data-tx-live-component="sidebar"]' },
  'split-view': { marker: '[data-tx-split-view], [data-tx-live-component="split-view"]' },
  stat: { marker: '[data-tx-stat], [data-tx-live-component="stat"]' },
  stepper: { marker: '[data-tx-stepper], [data-tx-live-component="stepper"]' },
  switch: { marker: '[data-tx-choice="switch"], button[role="switch"]', interact: 'button' },
  table: { marker: '[data-tx-table], [data-tx-table-wrap]' },
  tag: { marker: '[data-tx-tag]' },
  'text-counter': { marker: '[data-tx-live-component="text-counter"], textarea' },
  textarea: { marker: 'textarea, [data-tx-textarea]' },
  'time-field': { marker: '[data-tx-time]' },
  timeline: { marker: '[data-tx-timeline]' },
  toaster: { marker: '[data-tx-live-component="toaster"]', interact: 'button' },
  tooltip: { marker: '[data-tx-live-component="tooltip"]', interact: 'button' },
};

export function markerFor(id: string): LiveMarkerSpec {
  const base = LIVE_MARKERS[id] ?? { marker: `[data-tx-live-component="${id}"]` };
  // Always accept the exact live-component wrapper (identity for this catalog id).
  const exact = `[data-tx-live-component="${id}"]`;
  if (base.marker.includes(exact)) return base;
  return { ...base, marker: `${exact}, ${base.marker}` };
}

export const LIVE_CATALOG_IDS = Object.freeze(
  Object.keys(LIVE_MARKERS).sort((a, b) => a.localeCompare(b, 'en'))
);
