<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from 'texuli/table';
import { type CohortTableLabels, DEFAULT_COHORT_TABLE_LABELS } from './labels.ts';
import {
  type CohortCell,
  type CohortRow,
  type CohortValueKind,
  cellValue,
  cohortAverages,
  formatCohortValue,
  heatLevel,
  heatMax,
  periodCount,
} from './model.ts';
import './cohort.css';

interface Props {
  /** Cohorts, one row each: a label (the row header), an optional size and a cell per period. */
  rows: readonly CohortRow[];
  /** Period column headers ("Month 0", "Week 1"…); missing ones come from `labels.period`. */
  periods?: readonly string[];
  /** The table's accessible name: what is measured and how ("Share of users active each month after signup"). */
  caption: string;
  captionHidden?: boolean;
  /** Rates from 0 to 1 (default) or counts. */
  valueKind?: CohortValueKind;
  /** Display text of a value (default: a percent for rates, a grouped integer for counts). */
  format?: (value: number, kind: CohortValueKind) => string;
  /** Tints cells by value with fixed, contrast-safe steps; the number stays the content. */
  heat?: boolean;
  /** Top of the heat scale (default: 1 for rates, the largest cell for counts). */
  max?: number;
  /** Adds an averages row (`tfoot`), weighted by cohort size when every cohort has one. */
  average?: boolean;
  density?: 'compact' | 'default' | 'comfortable';
  locale?: string;
  labels?: Partial<CohortTableLabels>;
  class?: ClassValue;
}

let {
  rows,
  periods = [],
  caption,
  captionHidden = false,
  valueKind = 'rate',
  format,
  heat = false,
  max,
  average = false,
  density = 'compact',
  locale = 'en-US',
  labels,
  class: className,
}: Props = $props();

const text = $derived({ ...DEFAULT_COHORT_TABLE_LABELS, ...labels });
const count = $derived(periodCount(rows));
const headers = $derived(
  Array.from({ length: count }, (_, index) => periods[index] ?? text.period(index))
);
const sized = $derived(rows.some((row) => typeof row.size === 'number'));
const top = $derived(max ?? heatMax(rows, valueKind));
const averages = $derived(average ? cohortAverages(rows) : []);
const show = (value: number) =>
  (format ?? ((v, kind) => formatCohortValue(v, kind, locale)))(value, valueKind);
const level = (value: number | null) => (heat ? heatLevel(value, top) : null);
</script>

{#snippet valueCell(cell: CohortCell | undefined, header: string)}
  {@const { value, incomplete } = cellValue(cell)}
  {@const heatStep = level(value)}
  <TableCell
    numeric
    label={header}
    class={cx('tx-cohort__cell', incomplete && 'tx-cohort__cell--incomplete')}
    data-heat={heatStep ?? undefined}
  >
    {#if value === null}
      <span aria-hidden="true">—</span><span class="tx-cohort__sr-only">{` ${text.noData}`}</span>
    {:else}
      {show(value)}{#if incomplete}<span aria-hidden="true">*</span><span class="tx-cohort__sr-only"
          >{` ${text.incomplete}`}</span
        >{/if}
    {/if}
  </TableCell>
{/snippet}

<div class={cx('tx-cohort', className)} data-tx-cohort data-heat={heat || undefined}>
  <Table {density}>
    <TableCaption hidden={captionHidden}>{caption}</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead scope="col">{text.cohort}</TableHead>
        {#if sized}<TableHead scope="col" numeric>{text.size}</TableHead>{/if}
        {#each headers as header, index (index)}
          <TableHead scope="col" numeric>{header}</TableHead>
        {/each}
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each rows as row, index (row.id ?? `${index}:${row.label}`)}
        <TableRow>
          <TableHead scope="row" class="tx-cohort__label">{row.label}</TableHead>
          {#if sized}
            <TableCell numeric label={text.size}>
              {#if typeof row.size === 'number'}{formatCohortValue(row.size, 'count', locale)}{/if}
            </TableCell>
          {/if}
          {#each headers as header, period (period)}
            {@render valueCell(row.cells[period], header)}
          {/each}
        </TableRow>
      {/each}
    </TableBody>
    {#if average}
      <TableFooter>
        <TableRow>
          <TableHead scope="row" class="tx-cohort__label">{text.average}</TableHead>
          {#if sized}
            <TableCell numeric label={text.size}>
              {formatCohortValue(
                rows.reduce((sum, row) => sum + (row.size ?? 0), 0),
                'count',
                locale
              )}
            </TableCell>
          {/if}
          {#each headers as header, period (period)}
            {@render valueCell(averages[period] ?? null, header)}
          {/each}
        </TableRow>
      </TableFooter>
    {/if}
  </Table>
</div>
