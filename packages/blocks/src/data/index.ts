/**
 * `@texuli/blocks` data family (T-blocks-data): table, stat, kpi and chart.
 * Renderers load through `loadDataFamily()` or `@texuli/blocks/data/renderers`.
 */

export {
  CHART_KIND_PROPS,
  type ChartBlockProps,
  type ChartPropValue,
  type ExtendedChartKind,
  INLINE_CHART_PROPS,
  isExtendedChartKind,
} from './chart-kinds.ts';
export { checkDataBlock, type DataBlockCheck } from './check.ts';
export {
  DATA_BLOCK_TYPES,
  type DataBlockViewProps,
  type DataFamilyBlock,
  type DataFamilyBlockType,
  isDataFamilyBlock,
  loadDataFamily,
} from './family.ts';
export {
  type DataBlockLabelOverrides,
  type DataBlockLabels,
  DEFAULT_DATA_BLOCK_LABELS,
  resolveDataBlockLabels,
} from './labels.ts';
export {
  CHART_KINDS,
  type ChartBlock,
  type ChartHeatCell,
  type ChartKind,
  type ChartScatterPoint,
  type ChartSeries,
  type ChartSeriesPoint,
  type DataBlock,
  type DataBlockType,
  type InlineChartKind,
  type KpiBlock,
  type KpiItem,
  parseChartBlock,
  parseDataBlock,
  parseKpiBlock,
  parseStatBlock,
  parseTableBlock,
  type StatBlock,
  type StatItem,
  type TableBlock,
  type TableCellValue,
  type TableColumn,
  type TableRow,
} from './schema.ts';
