/**
 * `@texuli/blocks/data/engine` — Svelte-free table/stat/kpi/chart parsers and labels.
 */

import type {
  Block,
  ChartBlock,
  FieldIssue,
  KpiBlock,
  StatBlock,
  TableBlock,
} from '../core/index.ts';
import type { DataBlockLabelOverrides } from './labels.ts';

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

export const DATA_BLOCK_TYPES = ['table', 'stat', 'kpi', 'chart'] as const;
export type DataFamilyBlockType = (typeof DATA_BLOCK_TYPES)[number];
export type DataFamilyBlock = TableBlock | StatBlock | KpiBlock | ChartBlock;

export function isDataFamilyBlock(block: Block): block is DataFamilyBlock {
  return (DATA_BLOCK_TYPES as readonly string[]).includes(block.type);
}

export interface DataBlockViewProps {
  block: unknown;
  labels?: DataBlockLabelOverrides;
  oninvalid?: (issues: FieldIssue[]) => void;
  mode?: 'light' | 'dark';
}
