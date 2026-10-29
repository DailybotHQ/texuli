/**
 * Every catalog id → the live stage family that mounts its real component,
 * plus the exact public import and tag the code sample prints.
 *
 * Families load lazily (one chunk each), so a page pays only for the
 * families it shows. `isolate` families render landmarks of their own
 * (`main`, `banner`, `contentinfo`), so outside the gallery preview page
 * they mount in an isolated preview document instead of inline.
 */
import type { Component } from 'svelte';

export type StageFamily =
  | 'badge'
  | 'blocks'
  | 'button'
  | 'chart'
  | 'choice'
  | 'combobox'
  | 'command'
  | 'data'
  | 'dialog'
  | 'feedback'
  | 'field'
  | 'layout'
  | 'media'
  | 'menu'
  | 'nav'
  | 'page-layout'
  | 'popover'
  | 'select'
  | 'sheet'
  | 'table'
  | 'toast';

export type StageEntry = {
  family: StageFamily;
  /** Public import path printed in the code sample. */
  from: string;
  /** Imported binding (`Button`, `Select`, `DropdownMenu`…). */
  name: string;
  /** Element the code sample prints (`Select.Item`); defaults to `name`. */
  tag?: string;
  /** Text the code sample places between the tags. */
  children?: string;
  /** Preview height class in the gallery: sm 200, md 280, lg 360, xl 460 px. */
  height: 'sm' | 'md' | 'lg' | 'xl';
  /** Renders page landmarks: mount in an isolated preview document. */
  isolate?: boolean;
  /**
   * Operated in the preview document on component pages too (not inline),
   * so only that document links the family's CSS (`FRAMED_FAMILIES`).
   */
  framed?: boolean;
};

type StageProps = { componentId: string; values: Readonly<Record<string, unknown>> };
export type StageModule = { default: Component<StageProps> };

const e = (
  family: StageFamily,
  from: string,
  name: string,
  height: StageEntry['height'],
  extra: Partial<StageEntry> = {}
): StageEntry => ({ family, from, name, height, ...extra });

const CARTESIAN = '@texuli/charts/cartesian';
const COMPACT = '@texuli/charts/compact';
const FLOW = '@texuli/charts/flow';
const GEO = '@texuli/charts/geo';
const MATRIX = '@texuli/charts/matrix';
const PART = '@texuli/charts/part-whole';

export const STAGE_MAP: Readonly<Record<string, StageEntry>> = Object.freeze({
  // Content: blocks, charts, media.
  'blocks-data': e('blocks', '@texuli/blocks/data', 'DataBlockView', 'lg'),
  'blocks-diagram': e('blocks', '@texuli/blocks/diagram', 'DiagramBlockView', 'lg'),
  'blocks-embed': e('blocks', '@texuli/blocks/embed', 'EmbedBlockView', 'md'),
  'blocks-media': e('blocks', '@texuli/blocks/media', 'MediaBlockView', 'lg'),
  'blocks-text': e('blocks', '@texuli/blocks/text', 'TextBlockView', 'md'),
  'blocks-structure': e('blocks', '@texuli/blocks/structure', 'StructureFamily', 'lg'),
  'blocks-code': e('blocks', '@texuli/blocks/code', 'CodeBlockView', 'md'),
  'blocks-interactive': e('blocks', '@texuli/blocks/interactive', 'InteractiveBlockView', 'lg'),
  'blocks-map': e('blocks', '@texuli/blocks/map', 'MapBlockView', 'lg'),
  'charts-area': e('chart', CARTESIAN, 'AreaChart', 'lg'),
  'charts-bar': e('chart', CARTESIAN, 'BarChart', 'lg'),
  'charts-bubble': e('chart', MATRIX, 'BubbleChart', 'lg'),
  'charts-bullet': e('chart', COMPACT, 'BulletChart', 'sm'),
  'charts-canvas-renderer': e('chart', '@texuli/charts/canvas', 'CanvasRenderer', 'md'),
  'charts-cartesian': e('chart', CARTESIAN, 'CartesianChart', 'lg'),
  'charts-combo': e('chart', CARTESIAN, 'ComboChart', 'lg'),
  'charts-donut': e('chart', PART, 'DonutChart', 'xl'),
  'charts-funnel': e('chart', FLOW, 'FunnelChart', 'lg'),
  'charts-gauge': e('chart', COMPACT, 'Gauge', 'md'),
  'charts-geo-map': e('chart', GEO, 'GeoMap', 'xl'),
  'charts-geo-point-map': e('chart', GEO, 'GeoPointMap', 'xl'),
  'charts-heatmap': e('chart', MATRIX, 'HeatmapChart', 'lg'),
  'charts-line': e('chart', CARTESIAN, 'LineChart', 'lg'),
  'charts-network': e('chart', FLOW, 'NetworkGraph', 'xl'),
  'charts-pie': e('chart', PART, 'PieChart', 'xl'),
  'charts-progress-ring': e('chart', COMPACT, 'ProgressRing', 'sm'),
  'charts-sankey': e('chart', FLOW, 'SankeyChart', 'xl'),
  'charts-scatter': e('chart', MATRIX, 'ScatterChart', 'lg'),
  'charts-sparkline': e('chart', COMPACT, 'Sparkline', 'sm'),
  'charts-stacked-bar': e('chart', CARTESIAN, 'StackedBarChart', 'lg'),
  'charts-sunburst': e('chart', PART, 'SunburstChart', 'xl'),
  'charts-treemap': e('chart', PART, 'TreemapChart', 'xl'),
  'media-composition-canvas': e(
    'media',
    '@texuli/media/composition-canvas',
    'CompositionCanvas',
    'md'
  ),
  'media-composition-svg': e('media', '@texuli/media/composition-svg', 'CompositionSvg', 'md'),
  'media-image': e('media', '@texuli/media/image', 'Image', 'md'),

  // Display.
  alert: e('feedback', 'texuli/alert', 'Alert', 'md'),
  badge: e('badge', 'texuli/badge', 'Badge', 'sm', { children: 'Shipped' }),
  banner: e('feedback', 'texuli/alert', 'Banner', 'md'),
  callout: e('feedback', 'texuli/alert', 'Callout', 'md'),
  card: e('data', 'texuli/card', 'Card', 'md', { children: '…' }),
  chip: e('badge', 'texuli/badge', 'Chip', 'sm'),
  code: e('badge', 'texuli/kbd-code', 'Code', 'sm'),
  'empty-state': e('feedback', 'texuli/empty', 'EmptyState', 'md'),
  'error-state': e('feedback', 'texuli/empty', 'ErrorState', 'md'),
  kbd: e('badge', 'texuli/kbd-code', 'Kbd', 'sm', { children: '⌘K' }),
  kpi: e('data', 'texuli/stat', 'Kpi', 'md'),
  stat: e('data', 'texuli/stat', 'Stat', 'md'),
  stepper: e('data', 'texuli/stepper', 'Stepper', 'md'),
  table: e('table', 'texuli/table', 'Table', 'lg', { children: '…' }),
  tag: e('badge', 'texuli/badge', 'Tag', 'sm'),
  timeline: e('data', 'texuli/timeline', 'Timeline', 'lg'),

  // Forms.
  button: e('button', 'texuli/button', 'Button', 'sm', { children: 'Save note' }),
  'button-group': e('button', 'texuli/button', 'ButtonGroup', 'sm', { children: '…' }),
  checkbox: e('choice', 'texuli/choice', 'Checkbox', 'sm'),
  combobox: e('combobox', 'texuli/combobox', 'Combobox', 'lg', {
    framed: true,
    tag: 'Combobox.Root',
    children: '…',
  }),
  'multi-select': e('combobox', 'texuli/combobox', 'MultiSelect', 'lg', {
    framed: true,
    tag: 'MultiSelect.Root',
    children: '…',
  }),
  description: e('field', 'texuli/field', 'Description', 'sm', {
    children: 'Visible to your team only.',
  }),
  field: e('field', 'texuli/field', 'Field', 'md', { children: '…' }),
  'field-error': e('field', 'texuli/field', 'FieldError', 'sm', { children: 'Enter a team name.' }),
  form: e('field', 'texuli/field', 'Form', 'lg', { children: '…' }),
  'icon-button': e('button', 'texuli/button', 'IconButton', 'sm', { children: '…' }),
  'inline-text': e('badge', 'texuli/button', 'Button', 'sm', { children: 'Save changes' }),
  input: e('field', 'texuli/input', 'Input', 'sm'),
  'input-group': e('field', 'texuli/input', 'InputGroup', 'sm', { children: '…' }),
  label: e('field', 'texuli/field', 'Label', 'sm', { children: 'Email' }),
  radio: e('choice', 'texuli/choice', 'Radio', 'md'),
  'radio-group': e('choice', 'texuli/choice', 'RadioGroup', 'md'),
  select: e('select', 'texuli/select', 'Select', 'lg', { tag: 'Select.Root', children: '…' }),
  'select-content': e('select', 'texuli/select', 'Select', 'lg', {
    tag: 'Select.Content',
    children: '…',
  }),
  'select-group': e('select', 'texuli/select', 'Select', 'lg', {
    tag: 'Select.Group',
    children: '…',
  }),
  'select-item': e('select', 'texuli/select', 'Select', 'lg', { tag: 'Select.Item' }),
  'select-label': e('select', 'texuli/select', 'Select', 'lg', {
    tag: 'Select.Label',
    children: 'Plans',
  }),
  'select-portal': e('select', 'texuli/select', 'Select', 'lg', {
    tag: 'Select.Portal',
    children: '…',
  }),
  'select-separator': e('select', 'texuli/select', 'Select', 'lg', { tag: 'Select.Separator' }),
  'select-trigger': e('select', 'texuli/select', 'Select', 'lg', {
    tag: 'Select.Trigger',
    children: '…',
  }),
  'select-value': e('select', 'texuli/select', 'Select', 'lg', { tag: 'Select.Value' }),
  'select-viewport': e('select', 'texuli/select', 'Select', 'lg', {
    tag: 'Select.Viewport',
    children: '…',
  }),
  switch: e('choice', 'texuli/choice', 'Switch', 'sm'),
  'text-counter': e('field', 'texuli/input', 'TextCounter', 'sm'),
  textarea: e('field', 'texuli/input', 'Textarea', 'md'),
  'time-field': e('field', 'texuli/date', 'TimeField', 'sm'),

  // Layouts.
  'analytics-grid': e('layout', 'texuli/layouts/dashboard', 'AnalyticsGrid', 'lg', {
    children: '…',
  }),
  'content-layout': e('layout', 'texuli/layouts/host', 'LayoutHost', 'xl', {
    isolate: true,
    children: '…',
  }),
  'layout-auth-split': e('page-layout', 'texuli/layouts/auth-settings', 'AuthSplitLayout', 'xl', {
    isolate: true,
  }),
  'layout-blog': e('layout', 'texuli/layouts/content/blog', 'loadBlogLayout', 'xl', {
    tag: 'BlogLayout',
    isolate: true,
  }),
  'layout-card': e('page-layout', 'texuli/card', 'Card', 'md', { children: '…' }),
  'layout-chrome': e('layout', 'texuli/layouts/host/chrome', 'LayoutChrome', 'sm'),
  'layout-dashboard-grid': e('layout', 'texuli/layouts/dashboard', 'DashboardGridLayout', 'xl', {
    isolate: true,
  }),
  'layout-deck': e('page-layout', 'texuli/card', 'Card', 'lg', { children: '…' }),
  'deck-slide': e('page-layout', 'texuli/card', 'Card', 'lg', { children: '…' }),
  'layout-doc': e('page-layout', 'texuli/layouts/content/docs', 'loadDocsLayout', 'xl', {
    tag: 'DocsLayout',
    isolate: true,
  }),
  'layout-docs': e('layout', 'texuli/layouts/content/docs', 'loadDocsLayout', 'xl', {
    tag: 'DocsLayout',
    isolate: true,
  }),
  'layout-drawer': e('layout', 'texuli/layouts/host/drawer', 'LayoutDrawer', 'md', {
    children: '…',
  }),
  'layout-dual-sidebar': e('layout', 'texuli/layouts/app/dual-sidebar', 'DualSidebarLayout', 'xl', {
    isolate: true,
  }),
  'layout-editorial': e('layout', 'texuli/layouts/content/editorial', 'loadEditorialLayout', 'xl', {
    tag: 'EditorialLayout',
    isolate: true,
  }),
  'layout-grid': e('page-layout', 'texuli/card', 'CardGrid', 'lg', { children: '…' }),
  'layout-host': e('layout', 'texuli/layouts/host', 'LayoutHost', 'xl', {
    isolate: true,
    children: '…',
  }),
  'layout-landing': e('page-layout', 'texuli/layouts/marketing/landing', 'LandingLayout', 'xl', {
    isolate: true,
  }),
  'layout-marketing': e('page-layout', 'texuli/layouts/marketing', 'MarketingLayout', 'xl', {
    isolate: true,
  }),
  'layout-page': e('page-layout', 'texuli/layouts/host', 'LayoutHost', 'lg', { children: '…' }),
  'layout-pricing': e('page-layout', 'texuli/layouts/marketing/pricing', 'PricingLayout', 'xl', {
    isolate: true,
  }),
  'layout-settings': e('page-layout', 'texuli/layouts/auth-settings', 'SettingsLayout', 'xl'),
  'layout-sidebar': e('layout', 'texuli/layouts/app/sidebar', 'SidebarLayout', 'xl', {
    isolate: true,
  }),
  'layout-top-nav': e('layout', 'texuli/layouts/app/top-nav', 'TopNavLayout', 'xl', {
    isolate: true,
  }),
  'layout-wizard': e('page-layout', 'texuli/layouts/auth-settings', 'WizardLayout', 'xl', {
    isolate: true,
  }),
  'nav-icon': e('layout', 'texuli/layouts/host/chrome', 'NavIcon', 'sm'),
  'screen-outlet': e('layout', 'texuli/layouts/host', 'ScreenOutlet', 'xl', {
    isolate: true,
    children: '…',
  }),
  'split-view': e('layout', 'texuli/layouts/app/split-view', 'SplitView', 'lg'),

  // Overlays and navigation.
  'alert-dialog': e('dialog', 'texuli/dialog', 'AlertDialog', 'xl'),
  'app-nav': e('nav', 'texuli/sidebar', 'AppNav', 'xl', { isolate: true, children: '…' }),
  breadcrumb: e('nav', 'texuli/navigation', 'Breadcrumb', 'sm'),
  'command-palette': e('command', 'texuli/command', 'CommandPalette', 'xl'),
  'context-menu': e('menu', 'texuli/menus', 'ContextMenu', 'lg', {
    tag: 'ContextMenu.Root',
    children: '…',
  }),
  'context-menu-trigger': e('menu', 'texuli/menus', 'ContextMenu', 'lg', {
    tag: 'ContextMenu.Trigger',
    children: '…',
  }),
  'detail-panel': e('sheet', 'texuli/sheet', 'DetailPanel', 'xl', {
    tag: 'DetailPanel.Content',
    children: '…',
  }),
  dialog: e('dialog', 'texuli/dialog', 'Dialog', 'xl', { children: '…' }),
  drawer: e('sheet', 'texuli/sheet', 'Drawer', 'xl', { tag: 'Drawer.Content', children: '…' }),
  'dropdown-menu': e('menu', 'texuli/menus', 'DropdownMenu', 'lg', {
    tag: 'DropdownMenu.Root',
    children: '…',
  }),
  'dropdown-menu-content': e('menu', 'texuli/menus', 'DropdownMenu', 'lg', {
    tag: 'DropdownMenu.Content',
    children: '…',
  }),
  'dropdown-menu-item': e('menu', 'texuli/menus', 'DropdownMenu', 'lg', {
    tag: 'DropdownMenu.Item',
    children: 'New note',
  }),
  'dropdown-menu-trigger': e('menu', 'texuli/menus', 'DropdownMenu', 'lg', {
    tag: 'DropdownMenu.Trigger',
    children: 'Actions',
  }),
  'hover-card': e('popover', 'texuli/popover', 'HoverCard', 'lg', {
    tag: 'HoverCard.Root',
    children: '…',
  }),
  'hover-card-content': e('popover', 'texuli/popover', 'HoverCard', 'lg', {
    tag: 'HoverCard.Content',
    children: '…',
  }),
  menubar: e('menu', 'texuli/menus', 'Menubar', 'lg', { tag: 'Menubar.Root', children: '…' }),
  'menubar-trigger': e('menu', 'texuli/menus', 'Menubar', 'lg', {
    tag: 'Menubar.Trigger',
    children: 'File',
  }),
  'navigation-menu': e('nav', 'texuli/navigation', 'NavigationMenu', 'lg', {
    tag: 'NavigationMenu.Root',
    children: '…',
  }),
  pagination: e('nav', 'texuli/navigation', 'Pagination', 'sm', { tag: 'Pagination.Root' }),
  popover: e('popover', 'texuli/popover', 'Popover', 'lg', { tag: 'Popover.Root', children: '…' }),
  'popover-content': e('popover', 'texuli/popover', 'Popover', 'lg', {
    tag: 'Popover.Content',
    children: '…',
  }),
  'responsive-modal': e('sheet', 'texuli/sheet', 'ResponsiveModal', 'xl', {
    tag: 'ResponsiveModal.Content',
    children: '…',
  }),
  sheet: e('sheet', 'texuli/sheet', 'Sheet', 'xl', { tag: 'Sheet.Content', children: '…' }),
  sidebar: e('nav', 'texuli/sidebar', 'Sidebar', 'xl'),
  toaster: e('toast', 'texuli/toast', 'Toaster', 'lg'),
  tooltip: e('popover', 'texuli/tooltip', 'Tooltip', 'md', { children: '…' }),
});

export function stageFor(id: string): StageEntry | undefined {
  return Object.hasOwn(STAGE_MAP, id) ? STAGE_MAP[id] : undefined;
}
