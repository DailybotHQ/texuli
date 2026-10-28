/** Every visible or announced string of the cohort table. Pass translations to override. */
export interface CohortTableLabels {
  /** Header of the row-header column. */
  cohort: string;
  /** Header of a period column when `periods` does not name it (from 0). */
  period: (index: number) => string;
  /** Header of the size column. */
  size: string;
  /** Row header of the averages row. */
  average: string;
  /** Read for a period a cohort has not reached (the cell shows a dash). */
  noData: string;
  /** Read after a value that is still incomplete (the cell shows an asterisk). */
  incomplete: string;
}

export const DEFAULT_COHORT_TABLE_LABELS: Readonly<CohortTableLabels> =
  /* @__PURE__ */ Object.freeze({
    cohort: 'Cohort',
    period: (index: number) => `Period ${index}`,
    size: 'Users',
    average: 'Average',
    noData: 'No data yet',
    incomplete: '(incomplete)',
  });
