/**
 * `@texuli/data/cohort`: a cohort retention table with real table
 * semantics (caption, column headers for periods, row headers for cohorts,
 * `scope`), readable numbers and optional heat cells, plus its pure model.
 */
export { default as CohortTable } from './CohortTable.svelte';
export { type CohortTableLabels, DEFAULT_COHORT_TABLE_LABELS } from './labels.ts';
export {
  type CohortCell,
  type CohortCellValue,
  type CohortRow,
  type CohortValueKind,
  cellValue,
  cohortAverages,
  formatCohortValue,
  HEAT_LEVELS,
  heatLevel,
  heatMax,
  periodCount,
} from './model.ts';
