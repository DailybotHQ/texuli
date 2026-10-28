<script lang="ts">
import { type CohortRow, CohortTable } from '@texuli/data/cohort';

/**
 * `data-cohort-table`: cohorts from plain JSON. A row's values are numbers;
 * `incomplete` marks its last value as a period still in progress.
 */
interface Row {
  id?: string;
  label: string;
  size?: number;
  cells: readonly number[];
  incomplete?: boolean;
}

let {
  caption,
  rows,
  periods,
  captionHidden = false,
  valueKind = 'rate',
  heat = false,
  max,
  average = false,
  density = 'compact',
  locale = 'en-US',
}: {
  caption: string;
  rows: readonly Row[];
  periods?: readonly string[];
  captionHidden?: boolean;
  valueKind?: 'rate' | 'count';
  heat?: boolean;
  max?: number;
  average?: boolean;
  density?: 'compact' | 'default' | 'comfortable';
  locale?: string;
} = $props();

const cohorts = $derived(
  rows.map(
    (row): CohortRow => ({
      ...(row.id ? { id: row.id } : {}),
      label: row.label,
      ...(row.size !== undefined ? { size: row.size } : {}),
      cells: row.cells.map((value, index) =>
        row.incomplete === true && index === row.cells.length - 1
          ? { value, incomplete: true }
          : value
      ),
    })
  )
);
</script>

<CohortTable
  rows={cohorts}
  periods={periods ?? []}
  {caption}
  {captionHidden}
  {valueKind}
  {heat}
  {...max !== undefined ? { max } : {}}
  {average}
  {density}
  {locale}
/>
