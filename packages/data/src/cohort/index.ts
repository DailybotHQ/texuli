/**
 * `@texuli/data/cohort`: a cohort retention table with real table
 * semantics (caption, column headers for periods, row headers for cohorts,
 * `scope`), readable numbers and optional heat cells, plus its pure model.
 */
export { default as CohortTable } from './CohortTable.svelte';
export { type CohortTableLabels, DEFAULT_COHORT_TABLE_LABELS } from './labels.ts';
export {
  COHORT_HEAT_TOKENS,
  type CohortCell,
  type CohortCellValue,
  type CohortHeatScale,
  type CohortHeatStep,
  type CohortHeatText,
  type CohortHeatToken,
  type CohortRow,
  type CohortValueKind,
  cellValue,
  cohortAverages,
  DEFAULT_HEAT_TEXT,
  formatCohortValue,
  HEAT_LEVELS,
  HEAT_SCALE_LIMITS,
  HEAT_TEXT_MINIMUM,
  heatLevel,
  heatMax,
  periodCount,
  resolveHeatScale,
} from './model.ts';
