/**
 * Data-family block shapes and parsers (table, stat, chart, kpi).
 * Wired into the core `safeParseBlock` switch via `parseDataBlock`.
 */
import {
  BLOCK_CONTENT_LIMITS,
  type BlockBase,
  fail,
  ok,
  type ParseResult,
  parseMultilineText,
  parseOptionalPlainText,
  parsePlainText,
} from '../core/schema/primitives.ts';
import { type BlockTone, isBlockTone } from '../core/schema/vocabulary.ts';
import {
  type ChartBlockProps,
  type ExtendedChartKind,
  isExtendedChartKind,
  isPlain,
  parseChartKindProps,
  parseInlineData,
} from './chart-kinds.ts';

export type TableColumn = { id: string; label: string };
export type TableCellValue = string | number | null;
export type TableRow = Record<string, TableCellValue>;

export type TableBlock = BlockBase & {
  type: 'table';
  caption?: string;
  columns: TableColumn[];
  rows: TableRow[];
};

export type StatItem = {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  tone?: BlockTone;
  /** Sparkline values, oldest first (2–`trendPoints` finite numbers). */
  trend?: number[];
};

export type StatBlock = BlockBase & {
  type: 'stat';
  /** A visible title that also names the group. */
  title?: string;
  items: StatItem[];
  /** Where the figures come from, shown under them. */
  source?: string;
};

export type KpiItem = StatItem;

export type KpiBlock = BlockBase & {
  type: 'kpi';
  items: KpiItem[];
};

/** Original kinds with top-level `series`, `cells` or `points`. */
export type InlineChartKind =
  | 'line'
  | 'area'
  | 'bar'
  | 'stacked-bar'
  | 'combo'
  | 'heatmap'
  | 'scatter'
  | 'bubble';
/** Every `@texuli/charts` schema id without its `charts-` prefix. */
export type ChartKind = InlineChartKind | ExtendedChartKind;

export type ChartSeriesPoint = { x: string | number; y: number | null };
export type ChartSeries = {
  id: string;
  label: string;
  points: ChartSeriesPoint[];
  color?: string;
};

export type ChartHeatCell = { x: string; y: string; value: number };
export type ChartScatterPoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  r?: number;
  seriesId?: string;
  /** Theme token reference, e.g. `var(--tx-chart-2)`. */
  color?: string;
};

export type ChartBlock = BlockBase & {
  type: 'chart';
  kind: ChartKind;
  title: string;
  /** Accessible description (required). */
  description: string;
  series?: ChartSeries[];
  cells?: ChartHeatCell[];
  points?: ChartScatterPoint[];
  /** Validated chart props: required for extended kinds, optional extras otherwise. */
  props?: ChartBlockProps;
};

export type DataBlock = TableBlock | StatBlock | KpiBlock | ChartBlock;
export type DataBlockType = DataBlock['type'];

export const DATA_BLOCK_TYPES = [
  'table',
  'stat',
  'kpi',
  'chart',
] as const satisfies readonly DataBlockType[];

export const CHART_KINDS = [
  'line',
  'area',
  'bar',
  'stacked-bar',
  'combo',
  'heatmap',
  'scatter',
  'bubble',
  'pie',
  'donut',
  'sunburst',
  'treemap',
  'sparkline',
  'bullet',
  'gauge',
  'progress-ring',
  'funnel',
  'sankey',
  'network',
  'geo-map',
  'geo-point-map',
  'histogram',
  'pack',
  'calendar',
] as const satisfies readonly ChartKind[];

function plainObject(
  value: unknown,
  path: (string | number)[]
): ParseResult<Record<string, unknown>> {
  return isPlain(value) ? ok(value) : fail(path, 'Expected a plain object');
}

function parseTone(value: unknown, path: (string | number)[]): ParseResult<BlockTone | undefined> {
  if (value === undefined) return ok(undefined);
  if (!isBlockTone(value)) return fail(path, 'tone must be a known block tone');
  return ok(value);
}

function parseColumnId(value: unknown, path: (string | number)[]): ParseResult<string> {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,31}$/.test(value)) {
    return fail(path, 'column id must be a short lowercase token');
  }
  return ok(value);
}

export function parseTableBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<TableBlock> {
  if (!Array.isArray(record.columns) || record.columns.length === 0) {
    return fail([...path, 'columns'], 'table needs at least one column');
  }
  if (record.columns.length > BLOCK_CONTENT_LIMITS.tableColumns) {
    return fail(
      [...path, 'columns'],
      `table may have at most ${BLOCK_CONTENT_LIMITS.tableColumns} columns`
    );
  }
  if (!Array.isArray(record.rows)) {
    return fail([...path, 'rows'], 'table rows must be an array');
  }
  if (record.rows.length > BLOCK_CONTENT_LIMITS.tableRows) {
    return fail([...path, 'rows'], `table may have at most ${BLOCK_CONTENT_LIMITS.tableRows} rows`);
  }

  const columns: TableColumn[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < record.columns.length; i += 1) {
    const colPath = [...path, 'columns', i];
    const col = plainObject(record.columns[i], colPath);
    if (!col.success) return col;
    const id = parseColumnId(col.data.id, [...colPath, 'id']);
    if (!id.success) return id;
    if (ids.has(id.data)) return fail([...colPath, 'id'], `duplicate column id "${id.data}"`);
    ids.add(id.data);
    const label = parsePlainText(col.data.label, [...colPath, 'label'], BLOCK_CONTENT_LIMITS.plain);
    if (!label.success) return label;
    columns.push({ id: id.data, label: label.data });
  }

  const rows: TableRow[] = [];
  for (let r = 0; r < record.rows.length; r += 1) {
    const rowPath = [...path, 'rows', r];
    const rowObj = plainObject(record.rows[r], rowPath);
    if (!rowObj.success) return rowObj;
    const row: TableRow = {};
    for (const column of columns) {
      const raw = rowObj.data[column.id];
      if (raw === undefined || raw === null) {
        row[column.id] = null;
        continue;
      }
      if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) {
          return fail([...rowPath, column.id], 'numeric cells must be finite');
        }
        row[column.id] = raw;
        continue;
      }
      if (typeof raw === 'string') {
        const text = parsePlainText(raw, [...rowPath, column.id], BLOCK_CONTENT_LIMITS.plain);
        if (!text.success) return text;
        row[column.id] = text.data;
        continue;
      }
      return fail([...rowPath, column.id], 'cell must be string, number or null');
    }
    rows.push(row);
  }

  let caption: string | undefined;
  if (record.caption !== undefined) {
    const parsed = parsePlainText(record.caption, [...path, 'caption'], BLOCK_CONTENT_LIMITS.plain);
    if (!parsed.success) return parsed;
    caption = parsed.data;
  }

  return ok({
    ...base,
    type: 'table',
    columns,
    rows,
    ...(caption !== undefined ? { caption } : {}),
  });
}

function parseTrend(value: unknown, path: (string | number)[]): ParseResult<number[] | undefined> {
  if (value === undefined) return ok(undefined);
  const max = BLOCK_CONTENT_LIMITS.trendPoints;
  if (!Array.isArray(value) || value.length < 2 || value.length > max) {
    return fail(path, `trend needs 2–${max} numbers`);
  }
  for (let i = 0; i < value.length; i += 1) {
    const point = value[i];
    if (typeof point !== 'number' || !Number.isFinite(point)) {
      return fail([...path, i], 'Expected a finite number');
    }
  }
  return ok([...(value as number[])]);
}

function parseStatItems(
  value: unknown,
  path: (string | number)[],
  max: number
): ParseResult<StatItem[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return fail(path, 'needs at least one item');
  }
  if (value.length > max) {
    return fail(path, `at most ${max} items`);
  }
  const items: StatItem[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const itemPath = [...path, i];
    const item = plainObject(value[i], itemPath);
    if (!item.success) return item;
    const label = parsePlainText(
      item.data.label,
      [...itemPath, 'label'],
      BLOCK_CONTENT_LIMITS.plain
    );
    if (!label.success) return label;
    const val = parsePlainText(item.data.value, [...itemPath, 'value'], BLOCK_CONTENT_LIMITS.plain);
    if (!val.success) return val;
    let hint: string | undefined;
    if (item.data.hint !== undefined) {
      const parsed = parsePlainText(
        item.data.hint,
        [...itemPath, 'hint'],
        BLOCK_CONTENT_LIMITS.plain
      );
      if (!parsed.success) return parsed;
      hint = parsed.data;
    }
    let delta: string | undefined;
    if (item.data.delta !== undefined) {
      const parsed = parsePlainText(
        item.data.delta,
        [...itemPath, 'delta'],
        BLOCK_CONTENT_LIMITS.plain
      );
      if (!parsed.success) return parsed;
      delta = parsed.data;
    }
    const tone = parseTone(item.data.tone, [...itemPath, 'tone']);
    if (!tone.success) return tone;
    const trend = parseTrend(item.data.trend, [...itemPath, 'trend']);
    if (!trend.success) return trend;
    items.push({
      label: label.data,
      value: val.data,
      ...(hint !== undefined ? { hint } : {}),
      ...(delta !== undefined ? { delta } : {}),
      ...(tone.data !== undefined ? { tone: tone.data } : {}),
      ...(trend.data !== undefined ? { trend: trend.data } : {}),
    });
  }
  return ok(items);
}

export function parseStatBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<StatBlock> {
  const title = parseOptionalPlainText(
    record.title,
    [...path, 'title'],
    BLOCK_CONTENT_LIMITS.plain
  );
  if (!title.success) return title;
  const items = parseStatItems(record.items, [...path, 'items'], BLOCK_CONTENT_LIMITS.statItems);
  if (!items.success) return items;
  const source = parseOptionalPlainText(
    record.source,
    [...path, 'source'],
    BLOCK_CONTENT_LIMITS.plain
  );
  if (!source.success) return source;
  return ok({
    ...base,
    type: 'stat',
    ...(title.data !== undefined ? { title: title.data } : {}),
    items: items.data,
    ...(source.data !== undefined ? { source: source.data } : {}),
  });
}

export function parseKpiBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<KpiBlock> {
  const items = parseStatItems(record.items, [...path, 'items'], BLOCK_CONTENT_LIMITS.statItems);
  if (!items.success) return items;
  return ok({ ...base, type: 'kpi', items: items.data });
}

export function parseChartBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<ChartBlock> {
  if (
    typeof record.kind !== 'string' ||
    !(CHART_KINDS as readonly string[]).includes(record.kind)
  ) {
    return fail([...path, 'kind'], `kind must be one of ${CHART_KINDS.join(', ')}`);
  }
  const kind = record.kind as ChartKind;
  const title = parsePlainText(record.title, [...path, 'title'], BLOCK_CONTENT_LIMITS.heading);
  if (!title.success) return title;
  const description = parseMultilineText(
    record.description,
    [...path, 'description'],
    BLOCK_CONTENT_LIMITS.shortMarkdown
  );
  if (!description.success) return description;

  if (isExtendedChartKind(kind)) {
    const props = parseChartKindProps(kind, record.props, [...path, 'props']);
    if (!props.success) return props;
    return ok({
      ...base,
      type: 'chart',
      kind,
      title: title.data,
      description: description.data,
      props: props.data,
    });
  }

  let props: ChartBlockProps | undefined;
  if (record.props !== undefined) {
    const parsed = parseChartKindProps(kind, record.props, [...path, 'props']);
    if (!parsed.success) return parsed;
    props = parsed.data;
  }
  const extras = props === undefined ? {} : { props };

  if (kind === 'heatmap') {
    const cells = parseInlineData(kind, record.cells, [...path, 'cells']);
    if (!cells.success) return cells;
    return ok({
      ...base,
      type: 'chart',
      kind,
      title: title.data,
      description: description.data,
      cells: cells.data as ChartHeatCell[],
      ...extras,
    });
  }

  if (kind === 'scatter' || kind === 'bubble') {
    const points = parseInlineData(kind, record.points, [...path, 'points']);
    if (!points.success) return points;
    return ok({
      ...base,
      type: 'chart',
      kind,
      title: title.data,
      description: description.data,
      points: points.data as ChartScatterPoint[],
      ...extras,
    });
  }

  const series = parseInlineData(kind, record.series, [...path, 'series']);
  if (!series.success) return series;
  return ok({
    ...base,
    type: 'chart',
    kind,
    title: title.data,
    description: description.data,
    series: series.data as ChartSeries[],
    ...extras,
  });
}

/** Dispatch for the four data block types; returns null when type is not data. */
export function parseDataBlock(
  type: string,
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<DataBlock> | null {
  switch (type) {
    case 'table':
      return parseTableBlock(record, path, base);
    case 'stat':
      return parseStatBlock(record, path, base);
    case 'kpi':
      return parseKpiBlock(record, path, base);
    case 'chart':
      return parseChartBlock(record, path, base);
    default:
      return null;
  }
}
