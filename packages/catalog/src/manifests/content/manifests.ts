import { type CatalogManifest, defineCatalogManifest } from '../../manifest/index.ts';
import { CONTENT_PROP_NAMES, type ContentManifestId } from './prop-names.ts';

type PropKind = CatalogManifest['props'][number]['kind'];

/** Labels that `labelOf` cannot derive from the id. */
const LABELS: Partial<Record<ContentManifestId, string>> = {
  'charts-progress-ring': 'Progress ring',
  'charts-sparkline': 'Sparkline',
  'charts-canvas-renderer': 'Canvas chart renderer',
  'charts-network': 'Network graph',
  'charts-geo-map': 'Geographic map',
  'charts-geo-point-map': 'Geographic point map',
  'charts-heatmap': 'Heatmap',
  'media-image': 'Responsive image',
  'media-composition-svg': 'SVG composition',
  'media-composition-canvas': 'Canvas composition',
};

/** `blocks-text` is "Text blocks", `charts-stacked-bar` "Stacked bar chart". */
function labelOf(id: ContentManifestId): string {
  const [family, ...words] = id.split('-');
  const name = words.join(' ');
  const title = `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return LABELS[id] ?? `${title} ${family === 'blocks' ? 'blocks' : 'chart'}`;
}

const SUMMARIES: Record<ContentManifestId, string> = {
  'blocks-text': 'Validated heading, paragraph, list, quote and callout content.',
  'blocks-data': 'Validated tables, statistics, key metrics and chart content blocks.',
  'blocks-diagram': 'Validated flow, tree, board and terminal diagrams.',
  'blocks-media': 'Validated image, figure, video and gallery content blocks.',
  'blocks-embed':
    'Validated link previews (URL policy) and embed-app shells. Texuli never runs app JSON; hosts mount via mountEmbed with a sandboxed iframe contract.',
  'blocks-structure': 'Validated layouts and calls to action.',
  'blocks-code': 'Validated, highlighted code.',
  'blocks-interactive': 'Validated polls, quizzes, calculators and checklists.',
  'blocks-map': 'Validated map points and routes.',
  'charts-area': 'A categorical area chart with an accessible data table.',
  'charts-bar': 'A categorical bar chart with a zero baseline and accessible data table.',
  'charts-cartesian': 'The general line, area, bar, stacked bar or combo chart renderer.',
  'charts-combo': 'A categorical chart that combines bar and line series.',
  'charts-line': 'A categorical line chart with accessible values.',
  'charts-stacked-bar': 'A categorical stacked bar chart with accessible values.',
  'charts-bullet': 'A compact value, range and target comparison.',
  'charts-gauge': 'A radial value gauge with thresholds and an accessible data table.',
  'charts-progress-ring': 'A compact radial progress indicator with a data table.',
  'charts-sparkline': 'A compact line, area or bar trend chart.',
  'charts-canvas-renderer': 'A low-level canvas mark renderer for dense chart series.',
  'charts-funnel': 'A conversion funnel with step values and accessible table.',
  'charts-network': 'A node and connection graph with an accessible table.',
  'charts-sankey': 'A weighted flow diagram with an accessible table.',
  'charts-geo-map': 'A tiled geographic choropleth with a tabular data alternative.',
  'charts-geo-point-map': 'Geographic points positioned on a tiled map.',
  'charts-bubble': 'A scatter plot where point size can encode another measure.',
  'charts-heatmap': 'A matrix of labeled cells with an accessible data table.',
  'charts-scatter': 'A quantitative scatter plot with an accessible data table.',
  'charts-donut': 'A part-to-whole chart with a central opening and data table.',
  'charts-pie': 'A part-to-whole chart with an accessible data table.',
  'charts-sunburst': 'A hierarchical part-to-whole chart with an accessible table.',
  'charts-treemap': 'A hierarchical part-to-whole chart with an accessible table.',
  'media-image': 'A responsive image with URL validation, loading states and actions.',
  'media-composition-svg': 'A validated, structured vector composition.',
  'media-composition-canvas': 'A validated layered composition rendered to a canvas.',
};

/** Every `blocks-*` id requires only `block`. */
const REQUIRED: Partial<Record<ContentManifestId, readonly string[]>> = {
  'charts-area': ['title', 'description', 'series'],
  'charts-bar': ['title', 'description', 'series'],
  'charts-cartesian': ['kind', 'title', 'description', 'series'],
  'charts-combo': ['title', 'description', 'series'],
  'charts-line': ['title', 'description', 'series'],
  'charts-stacked-bar': ['title', 'description', 'series'],
  'charts-bullet': ['label', 'value'],
  'charts-gauge': ['label', 'value'],
  'charts-progress-ring': ['label', 'value'],
  'charts-sparkline': ['values', 'label'],
  'charts-canvas-renderer': ['kind', 'series', 'width', 'height'],
  'charts-funnel': ['title', 'steps'],
  'charts-network': ['title', 'nodes', 'links'],
  'charts-sankey': ['title', 'nodes', 'links'],
  'charts-geo-map': ['title', 'description', 'data'],
  'charts-geo-point-map': ['title', 'description', 'points'],
  'charts-bubble': ['title', 'description', 'points'],
  'charts-heatmap': ['title', 'description', 'cells'],
  'charts-scatter': ['title', 'description', 'points'],
  'charts-donut': ['title', 'description', 'data', 'labels'],
  'charts-pie': ['title', 'description', 'data', 'labels'],
  'charts-sunburst': ['title', 'description', 'root', 'labels'],
  'charts-treemap': ['title', 'description', 'root', 'labels'],
  'media-image': ['src', 'alt'],
  'media-composition-svg': ['composition'],
  'media-composition-canvas': ['composition'],
};

/** Array props by name; `data` is an array only on donut and pie charts. */
const ARRAY_PROPS = new Set([
  'series',
  'points',
  'shape',
  'nodes',
  'links',
  'steps',
  'cells',
  'ranges',
  'thresholds',
  'bandLabels',
  'values',
  'widths',
  'highlights',
]);

const ENUMS: Partial<Record<ContentManifestId, Record<string, readonly string[]>>> = {
  'blocks-data': { mode: ['light', 'dark'] },
  'charts-area': { mode: ['light', 'dark'], renderer: ['svg', 'canvas', 'auto'] },
  'charts-bar': { mode: ['light', 'dark'], renderer: ['svg', 'canvas', 'auto'] },
  'charts-cartesian': {
    kind: ['line', 'area', 'bar', 'stacked-bar', 'combo'],
    mode: ['light', 'dark'],
    renderer: ['svg', 'canvas', 'auto'],
  },
  'charts-combo': { mode: ['light', 'dark'], renderer: ['svg', 'canvas', 'auto'] },
  'charts-line': { mode: ['light', 'dark'], renderer: ['svg', 'canvas', 'auto'] },
  'charts-stacked-bar': { mode: ['light', 'dark'], renderer: ['svg', 'canvas', 'auto'] },
  'charts-sparkline': { variant: ['line', 'area', 'bar'] },
  'charts-canvas-renderer': { kind: ['line', 'area', 'bar', 'stacked-bar', 'combo'] },
  'charts-funnel': { orientation: ['vertical', 'horizontal'] },
  'charts-bubble': { mode: ['light', 'dark'] },
  'charts-heatmap': { mode: ['light', 'dark'] },
  'charts-scatter': { mode: ['light', 'dark'] },
  'media-image': {
    fit: ['cover', 'contain', 'fill', 'none', 'scale-down'],
    loading: ['eager', 'lazy'],
    fetchPriority: ['high', 'low', 'auto'],
    trust: ['developer', 'untrusted'],
  },
  'media-composition-svg': { trust: ['developer', 'untrusted'] },
  'media-composition-canvas': { trust: ['developer', 'untrusted'], dir: ['ltr', 'rtl'] },
};

const OBJECT_PROPS = new Set([
  'block',
  'data',
  'root',
  'labels',
  'composition',
  'focalPoint',
  'placeholder',
  'format',
]);
const NUMBER_PROPS = new Set([
  'value',
  'max',
  'min',
  'target',
  'size',
  'thickness',
  'height',
  'width',
  'padding',
  'pixelRatio',
  'headingLevel',
  'hostStep',
  'step',
]);
const BOOLEAN_PROPS = new Set(['showLast', 'validate', 'focusable', 'lineNumbers', 'copyable']);
/** Host callbacks besides the `on*` props. */
const EVENT_PROPS = new Set(['resolveAvatar', 'loadImage', 'loader', 'mountEmbed']);

function propKind(id: ContentManifestId, name: string): PropKind {
  if (ENUMS[id]?.[name]) return 'enum';
  if (name.startsWith('on') || EVENT_PROPS.has(name)) return 'event';
  if (
    ARRAY_PROPS.has(name) ||
    (name === 'data' && (id === 'charts-donut' || id === 'charts-pie'))
  ) {
    return 'array';
  }
  if (BOOLEAN_PROPS.has(name)) return 'boolean';
  if (NUMBER_PROPS.has(name)) return 'number';
  if (OBJECT_PROPS.has(name)) return 'object';
  return 'string';
}

function propSchemas(id: ContentManifestId): CatalogManifest['props'] {
  const required = new Set(id.startsWith('blocks-') ? ['block'] : (REQUIRED[id] ?? []));
  return CONTENT_PROP_NAMES[id].map((name) => {
    const enumValues = ENUMS[id]?.[name];
    return {
      name,
      kind: propKind(id, name),
      ...(required.has(name) ? { required: true } : {}),
      ...(enumValues ? { enumValues } : {}),
      ...(name.startsWith('on') || EVENT_PROPS.has(name)
        ? {
            description:
              name === 'mountEmbed'
                ? 'Host runtime after user Start. Prefer createSandboxedEmbedMount (sandbox without allow-same-origin, referrerpolicy=no-referrer, HTTPS allowlist). Host CSP frame-src + postMessage origin checks required; never relax sandbox or inject HTML from app data.'
                : 'Host-provided callback; omit when no host behavior is needed.',
          }
        : {}),
      ...(name === 'block'
        ? {
            description: 'Untrusted block data validated by the component before rendering.',
            trust: 'untrusted' as const,
          }
        : {}),
      ...(name === 'src' || name === 'href'
        ? {
            description: 'URL input is checked by the package URL policy.',
            trust: 'untrusted' as const,
          }
        : {}),
    };
  });
}

const EXAMPLES: Record<ContentManifestId, Readonly<Record<string, unknown>>> = {
  'blocks-text': { block: { type: 'heading', level: 2, text: 'Quarterly update' } },
  'blocks-data': { block: { type: 'stat', items: [{ label: 'Active', value: '128' }] } },
  'blocks-diagram': {
    block: { type: 'flow', nodes: [{ id: 'plan', label: 'Plan' }], edges: [] },
  },
  'blocks-media': {
    block: {
      type: 'image',
      src: 'images/team.webp',
      alt: 'A team planning together',
      width: 960,
      height: 540,
    },
  },
  'blocks-embed': {
    block: { type: 'link-preview', href: 'https://example.com/guide', title: 'Product guide' },
  },
  'blocks-structure': {
    block: {
      type: 'cta',
      actions: [{ label: 'Docs', href: 'https://example.com' }],
    },
  },
  'blocks-code': { block: { type: 'code', code: 'n = 1' } },
  'blocks-interactive': { block: { type: 'checklist', items: [{ id: 'a', label: 'Plan' }] } },
  'blocks-map': {
    block: { type: 'map', label: 'Depot', points: [{ id: 'a', label: 'Depot', lng: 0, lat: 0 }] },
  },
  'charts-area': { title: 'Weekly activity', description: 'Activity by week', series: [] },
  'charts-bar': { title: 'Weekly activity', description: 'Activity by week', series: [] },
  'charts-cartesian': {
    kind: 'line',
    title: 'Weekly activity',
    description: 'Activity by week',
    series: [],
  },
  'charts-combo': {
    title: 'Revenue and orders',
    description: 'Revenue and orders by month',
    series: [],
  },
  'charts-line': { title: 'Weekly activity', description: 'Activity by week', series: [] },
  'charts-stacked-bar': { title: 'Weekly activity', description: 'Activity by week', series: [] },
  'charts-bullet': { label: 'Release progress', value: 68, max: 100, target: 75 },
  'charts-gauge': { label: 'Service health', value: 92, min: 0, max: 100 },
  'charts-progress-ring': { label: 'Tasks complete', value: 8, max: 10 },
  'charts-sparkline': { label: 'Daily active users', values: [18, 21, 19, 26] },
  'charts-canvas-renderer': { kind: 'line', series: [], width: 640, height: 320 },
  'charts-funnel': {
    title: 'Signup conversion',
    steps: [{ id: 'visit', label: 'Visits', value: 800 }],
  },
  'charts-network': { title: 'Team dependencies', nodes: [], links: [] },
  'charts-sankey': { title: 'Traffic sources', nodes: [], links: [] },
  'charts-geo-map': { title: 'Orders by region', description: 'Regional order totals', data: {} },
  'charts-geo-point-map': { title: 'Locations', description: 'Sample locations', points: [] },
  'charts-bubble': {
    title: 'Usage and reach',
    description: 'Usage compared with reach',
    points: [],
  },
  'charts-heatmap': { title: 'Weekly volume', description: 'Volume by day and hour', cells: [] },
  'charts-scatter': {
    title: 'Usage and reach',
    description: 'Usage compared with reach',
    points: [],
  },
  'charts-donut': {
    title: 'Tickets by status',
    description: 'Ticket distribution',
    data: [],
    labels: {},
  },
  'charts-pie': {
    title: 'Tickets by status',
    description: 'Ticket distribution',
    data: [],
    labels: {},
  },
  'charts-sunburst': {
    title: 'Revenue structure',
    description: 'Revenue by product group',
    root: { id: 'root', value: 0 },
    labels: {},
  },
  'charts-treemap': {
    title: 'Revenue structure',
    description: 'Revenue by product group',
    root: { id: 'root', value: 0 },
    labels: {},
  },
  'media-image': { src: 'images/team.webp', alt: 'A team planning together' },
  'media-composition-svg': { composition: { width: 320, height: 180, layers: [] } },
  'media-composition-canvas': { composition: { width: 320, height: 180, layers: [] } },
};

function makeManifest(id: ContentManifestId): CatalogManifest {
  // `blocks-*` ships in @texuli/blocks, `charts-*` in @texuli/charts, `media-*` in @texuli/media.
  const packageName = `@texuli/${id.split('-')[0]}`;
  const label = labelOf(id);
  const isEmbed = id === 'blocks-embed';
  return defineCatalogManifest({
    id,
    package: packageName,
    label,
    summary: SUMMARIES[id],
    tier: 'content',
    agentEmittable: true,
    useWhen: isEmbed
      ? [
          'Show a deferred mini-app shell where the host mounts after user Start.',
          'Show an offline link preview with HTTPS-only href (URL policy).',
        ]
      : [`Render ${label.toLowerCase()} from structured content data.`],
    dontUseWhen: isEmbed
      ? [
          'Application navigation, account controls or mutations.',
          'Running untrusted app JSON with innerHTML, eval, or an unsandboxed iframe.',
          'Relaxing iframe sandbox (especially adding allow-same-origin) or skipping CSP frame-src / postMessage origin checks.',
        ]
      : ['Application navigation, account controls or mutations.'],
    a11y: isEmbed
      ? [
          'Start control is a real button; nothing loads until activation.',
          'Iframe title (when used) names the embedded app; host must keep keyboard access inside the frame.',
          'Link previews use rel=noopener noreferrer on new-window links.',
        ]
      : [
          'Provide the required accessible title, description or text alternatives.',
          'Keep data available in the component-provided text or table alternative.',
        ],
    props: propSchemas(id),
    examples: [{ id: 'basic', title: `${label} example`, props: EXAMPLES[id] }],
  });
}

export const CONTENT_MANIFESTS = Object.freeze(
  (Object.keys(CONTENT_PROP_NAMES) as ContentManifestId[]).map(makeManifest)
);

export const CONTENT_PROP_NAME_MAP = CONTENT_PROP_NAMES;

export const contentManifestsById = Object.freeze(
  Object.fromEntries(CONTENT_MANIFESTS.map((manifest) => [manifest.id, manifest])) as Record<
    ContentManifestId,
    CatalogManifest
  >
);
