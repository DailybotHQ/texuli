<script lang="ts">
import { type CohortRow, CohortTable } from '@texuli/data/cohort';

// Fictional data only.
const rows: CohortRow[] = [
  { label: 'Jun 2026', size: 412, cells: [1, 0.62, 0.48, 0.41, 0.37] },
  { label: 'Jul 2026', size: 388, cells: [1, 0.58, 0.45, 0.39, { value: 0.36, incomplete: true }] },
  { label: 'Aug 2026', size: 455, cells: [1, 0.66, 0.51, { value: 0.47, incomplete: true }] },
  { label: 'Sep 2026', size: 501, cells: [1, 0.7, { value: 0.55, incomplete: true }] },
  { label: 'Oct 2026', size: 297, cells: [1, { value: 0.21, incomplete: true }] },
];
const periods = ['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4'];
const counts: CohortRow[] = [
  { label: 'Week of Sep 7', cells: [120, 84, 61] },
  { label: 'Week of Sep 14', cells: [96, 70] },
  { label: 'Week of Sep 21', cells: [143] },
];
</script>

<section class="demo" data-example="data-cohort" aria-labelledby="data-cohort-title">
  <h2 id="data-cohort-title">Retention</h2>
  <p>
    Rows are signup cohorts, columns are months since signup. A dash means the cohort has not
    reached that month; an asterisk marks a month still in progress.
  </p>
  <CohortTable
    {rows}
    {periods}
    caption="Share of each signup cohort still active, by month since signup"
    heat
    average
  />
  <h3>Active users by signup week</h3>
  <CohortTable
    rows={counts}
    periods={['Week 0', 'Week 1', 'Week 2']}
    caption="Active users by signup week"
    captionHidden
    valueKind="count"
    labels={{ cohort: 'Signup week' }}
  />
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 56rem;
    padding: 1.5rem;
  }
  .demo h2,
  .demo h3,
  .demo p {
    margin: 0;
  }
</style>
