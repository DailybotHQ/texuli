/**
 * Extended chart kinds: every `@texuli/charts` schema id beyond the seven
 * original block kinds, validated as untrusted JSON under `props`.
 *
 * The spec is a compact local copy of the blueprint props in
 * `@texuli/charts/schemas` (that module is too large for the core budget);
 * `tests/chart-parity.test.ts` keeps the two in step. Developer-only props
 * (callbacks, `class`) and the block-owned `title`, `description`, `label`
 * and `mode` are never accepted here.
 */
import {
  BLOCK_CONTENT_LIMITS,
  fail,
  ok,
  type ParseResult,
  parsePlainText,
} from '../core/schema/primitives.ts';

/** JSON value accepted inside an extended chart block's `props`. */
export type ChartPropValue =
  | string
  | number
  | boolean
  | null
  | readonly ChartPropValue[]
  | { readonly [key: string]: ChartPropValue };
export type ChartBlockProps = { readonly [key: string]: ChartPropValue };

/**
 * Value spec. Strings: `text` plain text · `num` finite · `num?` finite or null
 * · `nonneg` ≥ 0 · `pos` > 0 · `dim` pixel size in (0, 4096] · `int` integer
 * · `bool` · `date` ISO date or epoch ms · `pair` two finite numbers · `tree`
 * recursive hierarchy. Objects: `{ e }` enum, `{ a, u, n }` array (unique by
 * `u`, at most `n` items, default 64), `{ o }` closed object, `{ r, n }` record
 * with plain-text keys, `{ min, max, int }` bounded number.
 */
type Spec =
  | 'text'
  | 'num'
  | 'num?'
  | 'nonneg'
  | 'pos'
  | 'dim'
  | 'int'
  | 'bool'
  | 'date'
  | 'pair'
  | 'tree'
  | 'token'
  | 'textnum'
  | 'color'
  | { e: readonly string[] }
  | { a: Spec; u?: string; n?: number; m?: number }
  | { o: Fields }
  | { v: readonly Fields[] }
  | { r: Spec; n?: number }
  | { min: number; max: number; int?: boolean };
/** Field name → spec; a trailing `!` marks the field required. */
type Fields = Readonly<Record<string, Spec>>;

const MAX_ITEMS = 64;
const TREE_DEPTH = 6;
const TREE_NODES = 256;
const CALENDAR_DAYS = 400;

/** Closed, all-optional label objects; `keys` is space-separated. */
const optionalLabels = (keys: string): Spec => ({
  o: Object.fromEntries(keys.split(' ').map((key) => [key, 'text' as const])),
});
const partWholeLabels = optionalLabels('table category value');

/** Compact chart value formatting (the charts `ChartFormatSpec`); the type picks the variant. */
const chartFormat: Spec = {
  v: [
    {
      'type!': { e: ['number'] },
      locale: 'text',
      style: { e: ['decimal', 'percent', 'currency'] },
      currency: 'text',
      notation: { e: ['standard', 'compact'] },
      minimumFractionDigits: { min: 0, max: 20, int: true },
      maximumFractionDigits: { min: 0, max: 20, int: true },
    },
    {
      'type!': { e: ['date'] },
      locale: 'text',
      timeZone: 'text',
      dateStyle: { e: ['short', 'medium', 'long', 'full'] },
      timeStyle: { e: ['short', 'medium', 'long', 'full'] },
    },
  ],
};
const compactLabels = optionalLabels(
  'tableSummary measure point value noData current minimum maximum target range complete total percent'
);
const flowLabels = optionalLabels(
  'tableSummary step count conversion from to value node connection'
);
const geoLabels = optionalLabels('table region point location value noData low high');
const geoShape: Spec = {
  a: { o: { 'id!': 'text', 'label!': 'text', 'abbr!': 'text', 'col!': 'int', 'row!': 'int' } },
  u: 'id',
  n: 256,
};
const box: Fields = { width: 'dim', height: 'dim' };
const pie: Fields = {
  'data!': { a: { o: { 'id!': 'text', 'label!': 'text', 'value!': 'num' } }, u: 'id' },
  labels: partWholeLabels,
  size: 'dim',
  innerRatio: { min: 0, max: 0.85 },
  padAngle: 'nonneg',
};
const flowNodes = (value: Spec): Spec => ({
  a: { o: { 'id!': 'text', label: 'text', value } },
  u: 'id',
});
const flowLinks = (value: string): Spec => ({
  a: { o: { 'source!': 'text', 'target!': 'text', [value]: 'pos' } },
  n: 128,
});

/** Props per extended kind (the kind is the chart id without `charts-`). */
export const CHART_KIND_PROPS = {
  pie,
  donut: pie,
  sunburst: {
    'root!': 'tree',
    labels: partWholeLabels,
    size: 'dim',
    innerRatio: { min: 0, max: 0.75 },
    padAngle: 'nonneg',
  },
  treemap: { 'root!': 'tree', labels: partWholeLabels, ...box, padding: 'nonneg' },
  sparkline: {
    'values!': { a: 'num?', n: 256 },
    format: chartFormat,
    period: 'text',
    variant: { e: ['line', 'area', 'bar'] },
    height: 'dim',
    showLast: 'bool',
    labels: compactLabels,
  },
  bullet: {
    'value!': 'num',
    max: 'pos',
    format: chartFormat,
    target: 'num',
    ranges: { a: 'num', n: 8 },
    labels: compactLabels,
  },
  gauge: {
    'value!': 'num',
    format: chartFormat,
    min: 'num',
    max: 'num',
    thresholds: { a: 'num', n: 8 },
    bandLabels: { a: 'text', n: 9 },
    size: 'dim',
    thickness: 'dim',
    labels: compactLabels,
  },
  'progress-ring': {
    'value!': 'num',
    format: chartFormat,
    max: 'pos',
    size: 'dim',
    thickness: 'dim',
    labels: compactLabels,
  },
  funnel: {
    'steps!': { a: { o: { 'id!': 'text', label: 'text', 'value!': 'num' } }, u: 'id', n: 12 },
    orientation: { e: ['vertical', 'horizontal'] },
    ...box,
    labels: flowLabels,
  },
  sankey: {
    'nodes!': flowNodes('text'),
    'links!': flowLinks('value!'),
    ...box,
    labels: flowLabels,
  },
  network: { 'nodes!': flowNodes('pos'), 'links!': flowLinks('value'), ...box, labels: flowLabels },
  'geo-map': { 'data!': { r: 'num?', n: 256 }, shape: geoShape, labels: geoLabels, ...box },
  'geo-point-map': {
    'points!': {
      a: {
        o: {
          'id!': 'text',
          'label!': 'text',
          'regionId!': 'text',
          'value!': 'num?',
          offset: { o: { 'x!': { min: -0.4, max: 0.4 }, 'y!': { min: -0.4, max: 0.4 } } },
        },
      },
      u: 'id',
    },
    shape: geoShape,
    labels: geoLabels,
    ...box,
  },
  histogram: {
    'values!': { a: 'num?', n: 1024 },
    thresholds: { a: 'num', n: MAX_ITEMS },
    binCount: { min: 1, max: MAX_ITEMS, int: true },
    domain: 'pair',
    labels: optionalLabels('table range count'),
    ...box,
  },
  pack: {
    'root!': 'tree',
    labels: partWholeLabels,
    ...box,
    padding: 'nonneg',
  },
  calendar: {
    'start!': 'date',
    'end!': 'date',
    values: { r: 'num', n: CALENDAR_DAYS },
    weekStartsOn: { min: 0, max: 6, int: true },
    cellSize: 'dim',
    gap: 'nonneg',
    labels: optionalLabels('table date value noData'),
  },
} as const satisfies Readonly<Record<string, Fields>>;

export type ExtendedChartKind = keyof typeof CHART_KIND_PROPS;

/** Reference lines, bands and point callouts; `y` is the y-axis value spec. */
const annotationsOf = (y: Spec): Spec => {
  const common = { 'id!': 'text', 'label!': 'text', color: 'color' } as const;
  const line = { e: ['line'] };
  const band = { e: ['band'] };
  const x = { e: ['x'] };
  const yAxis = { e: ['y'] };
  return {
    a: {
      v: [
        { ...common, 'type!': line, 'axis!': x, 'value!': 'textnum' },
        { ...common, 'type!': line, 'axis!': yAxis, 'value!': y },
        { ...common, 'type!': band, 'axis!': x, 'start!': 'textnum', 'end!': 'textnum' },
        { ...common, 'type!': band, 'axis!': yAxis, 'start!': y, 'end!': y },
        { ...common, 'type!': { e: ['point'] }, 'x!': 'textnum', 'y!': y },
      ],
    },
    u: 'id',
    n: 16,
  };
};
const cartesianExtras: Fields = {
  annotations: annotationsOf('num'),
  renderer: { e: ['svg', 'canvas', 'auto'] },
  interactive: 'bool',
  fullDomain: 'pair',
  visibleDomain: 'pair',
  xKind: { e: ['linear', 'category', 'time'] },
  locale: 'text',
};
const matrixExtras: Fields = { annotations: annotationsOf('textnum'), interactive: 'bool', ...box };
const scatterExtras: Fields = {
  ...matrixExtras,
  series: { a: { o: { 'id!': 'text', 'label!': 'text', color: 'color' } }, u: 'id', n: 8 },
};

/**
 * Optional `props` for kinds whose data stays top-level (`series`, `cells`,
 * `points`): the family's blueprint extras, nothing else.
 */
export const INLINE_CHART_PROPS = {
  line: cartesianExtras,
  area: cartesianExtras,
  bar: cartesianExtras,
  'stacked-bar': cartesianExtras,
  combo: cartesianExtras,
  heatmap: matrixExtras,
  scatter: scatterExtras,
  bubble: scatterExtras,
} as const satisfies Readonly<Record<string, Fields>>;

const TREE: Fields = {
  'id!': 'text',
  label: 'text',
  value: 'nonneg',
  children: { a: 'tree', u: 'id' },
};
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Series and annotation colors: theme token references only. */
export const TOKEN_COLOR = /^var\(--[a-z0-9-]+\)$/;

type Path = (string | number)[];
type Budget = { nodes: number };

export function isPlain(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function dateTime(value: ChartPropValue): number {
  return typeof value === 'number' ? value : Date.parse(`${value}T00:00:00Z`);
}

function parseFields(
  fields: Fields,
  value: unknown,
  path: Path,
  budget: Budget,
  depth: number
): ParseResult<ChartBlockProps> {
  if (!isPlain(value)) return fail(path, 'Expected a plain object');
  const known = new Map<string, { spec: Spec; required: boolean }>();
  for (const [key, spec] of Object.entries(fields)) {
    const required = key.endsWith('!');
    known.set(required ? key.slice(0, -1) : key, { spec, required });
  }
  const out: Record<string, ChartPropValue> = {};
  for (const key of Object.keys(value)) {
    if (!known.has(key)) return fail([...path, key], `Unknown chart prop "${key}"`);
  }
  for (const [key, { spec, required }] of known) {
    const raw = value[key];
    if (raw === undefined) {
      if (required) return fail([...path, key], `${key} is required`);
      continue;
    }
    const parsed = parseValue(spec, raw, [...path, key], budget, depth);
    if (!parsed.success) return parsed;
    out[key] = parsed.data;
  }
  return ok(out);
}

function parseValue(
  spec: Spec,
  value: unknown,
  path: Path,
  budget: Budget,
  depth: number
): ParseResult<ChartPropValue> {
  if (typeof spec === 'object') {
    if ('e' in spec) {
      return typeof value === 'string' && spec.e.includes(value)
        ? ok(value)
        : fail(path, `Expected one of ${spec.e.join(', ')}`);
    }
    if ('min' in spec) {
      if (!finite(value) || value < spec.min || value > spec.max) {
        return fail(path, `Expected a number from ${spec.min} to ${spec.max}`);
      }
      return spec.int && !Number.isInteger(value) ? fail(path, 'Expected an integer') : ok(value);
    }
    if ('o' in spec) return parseFields(spec.o, value, path, budget, depth);
    if ('v' in spec) {
      for (const fields of spec.v) {
        const parsed = parseFields(fields, value, path, budget, depth);
        if (parsed.success) return parsed;
      }
      return fail(path, 'Does not match any allowed shape');
    }
    const max = spec.n ?? MAX_ITEMS;
    if ('r' in spec) {
      if (!isPlain(value)) return fail(path, 'Expected a plain object');
      const entries = Object.entries(value);
      if (entries.length > max) return fail(path, `At most ${max} entries`);
      const out: Record<string, ChartPropValue> = {};
      for (const [key, item] of entries) {
        const name = parsePlainText(key, [...path, key], BLOCK_CONTENT_LIMITS.plain);
        if (!name.success) return name;
        const parsed = parseValue(spec.r, item, [...path, key], budget, depth);
        if (!parsed.success) return parsed;
        out[key] = parsed.data;
      }
      return ok(out);
    }
    if (!Array.isArray(value)) return fail(path, 'Expected an array');
    if (value.length > max) return fail(path, `At most ${max} items`);
    if (value.length < (spec.m ?? 0)) return fail(path, `At least ${spec.m} item needed`);
    const items: ChartPropValue[] = [];
    const seen = new Set<ChartPropValue>();
    for (let i = 0; i < value.length; i += 1) {
      const parsed = parseValue(spec.a, value[i], [...path, i], budget, depth);
      if (!parsed.success) return parsed;
      if (spec.u !== undefined) {
        const id = (parsed.data as ChartBlockProps)[spec.u] as ChartPropValue;
        if (seen.has(id)) return fail([...path, i, spec.u], `Duplicate ${spec.u} "${String(id)}"`);
        seen.add(id);
      }
      items.push(parsed.data);
    }
    return ok(items);
  }
  switch (spec) {
    case 'text':
      return parsePlainText(value, path, BLOCK_CONTENT_LIMITS.plain);
    case 'token':
      return typeof value === 'string' && /^[a-z][a-z0-9_-]{0,31}$/.test(value)
        ? ok(value)
        : fail(path, 'id must be a short lowercase token');
    case 'textnum':
      if (finite(value)) return ok(value);
      return parsePlainText(value, path, BLOCK_CONTENT_LIMITS.plain);
    case 'color':
      return typeof value === 'string' && TOKEN_COLOR.test(value)
        ? ok(value)
        : fail(path, 'color must be a CSS var(--token) reference');
    case 'bool':
      return typeof value === 'boolean' ? ok(value) : fail(path, 'Expected a boolean');
    case 'num?':
      if (value === null) return ok(null);
      return finite(value) ? ok(value) : fail(path, 'Expected a finite number or null');
    case 'pair':
      return Array.isArray(value) && value.length === 2 && value.every(finite)
        ? ok([value[0] as number, value[1] as number])
        : fail(path, 'Expected two finite numbers');
    case 'date':
      if (finite(value)) return ok(value);
      return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(dateTime(value))
        ? ok(value)
        : fail(path, 'Expected an ISO date (YYYY-MM-DD) or epoch milliseconds');
    case 'tree':
      budget.nodes += 1;
      if (depth >= TREE_DEPTH)
        return fail(path, `Hierarchy may be at most ${TREE_DEPTH} levels deep`);
      if (budget.nodes > TREE_NODES)
        return fail(path, `Hierarchy may have at most ${TREE_NODES} nodes`);
      return parseFields(TREE, value, path, budget, depth + 1);
  }
  if (!finite(value)) return fail(path, 'Expected a finite number');
  if (spec === 'int' && !Number.isInteger(value)) return fail(path, 'Expected an integer');
  if (spec === 'nonneg' && value < 0) return fail(path, 'Expected a number ≥ 0');
  if ((spec === 'pos' || spec === 'dim') && value <= 0) return fail(path, 'Expected a number > 0');
  if (spec === 'dim' && value > BLOCK_CONTENT_LIMITS.mediaDimension) {
    return fail(path, `Expected at most ${BLOCK_CONTENT_LIMITS.mediaDimension}`);
  }
  return ok(value);
}

/**
 * Top-level data of the inline kinds: cartesian `series` (1–8, each with 1–64
 * points), heatmap `cells` (at most 8 × 50) and scatter/bubble `points` (at
 * most 64, `r` required for bubble).
 */
export function parseInlineData(
  kind: keyof typeof INLINE_CHART_PROPS,
  value: unknown,
  path: Path
): ParseResult<ChartPropValue> {
  const spec: Spec =
    kind === 'heatmap'
      ? { a: { o: { 'x!': 'text', 'y!': 'text', 'value!': 'num' } }, n: 400, m: 1 }
      : kind === 'scatter' || kind === 'bubble'
        ? {
            a: {
              o: {
                'id!': 'token',
                'label!': 'text',
                'x!': 'num',
                'y!': 'num',
                [kind === 'bubble' ? 'r!' : 'r']: 'nonneg',
                seriesId: 'token',
                color: 'color',
              },
            },
            u: 'id',
            m: 1,
          }
        : {
            a: {
              o: {
                'id!': 'token',
                'label!': 'text',
                'points!': { a: { o: { 'x!': 'textnum', 'y!': 'num?' } }, u: 'x', m: 1 },
                color: 'color',
              },
            },
            u: 'id',
            n: 8,
            m: 1,
          };
  const parsed = parseValue(spec, value, path, { nodes: 0 }, 0);
  if (!parsed.success || kind === 'heatmap' || kind === 'scatter' || kind === 'bubble') {
    return parsed;
  }
  // Match the cartesian renderer's chart-wide category/numeric x domain.
  const series = parsed.data as readonly {
    readonly points: readonly { readonly x: string | number }[];
  }[];
  const xType = typeof series[0]?.points[0]?.x;
  return series.some((s) => s.points.some((p) => typeof p.x !== xType)) ? fail(path, 'x') : parsed;
}

export function isExtendedChartKind(kind: string): kind is ExtendedChartKind {
  return Object.hasOwn(CHART_KIND_PROPS, kind);
}

/** Validate `props` for one kind, including cross-field checks. */
export function parseChartKindProps(
  kind: ExtendedChartKind | keyof typeof INLINE_CHART_PROPS,
  value: unknown,
  path: Path
): ParseResult<ChartBlockProps> {
  const fields: Fields = isExtendedChartKind(kind)
    ? CHART_KIND_PROPS[kind]
    : INLINE_CHART_PROPS[kind];
  const parsed = parseFields(fields, value, path, { nodes: 0 }, 0);
  if (!parsed.success) return parsed;
  const props = parsed.data;
  if (kind === 'sankey' || kind === 'network') {
    const ids = new Set((props.nodes as ChartBlockProps[]).map((node) => node.id));
    const links = props.links as ChartBlockProps[];
    for (let i = 0; i < links.length; i += 1) {
      for (const end of ['source', 'target'] as const) {
        if (!ids.has(links[i]?.[end] as ChartPropValue)) {
          return fail([...path, 'links', i, end], `${end} must name a node id`);
        }
      }
    }
  }
  if (kind === 'calendar') {
    const start = dateTime(props.start as ChartPropValue);
    const end = dateTime(props.end as ChartPropValue);
    if (end < start || end - start > CALENDAR_DAYS * 86_400_000) {
      return fail([...path, 'end'], `end must follow start within ${CALENDAR_DAYS} days`);
    }
  }
  return ok(props);
}
