<script lang="ts">
import '../table/mini.css';
import { tableWindow } from '../interaction/model.ts';
import {
  type ChartFormatSpec,
  type CompactChartLabels,
  chartLabels,
  describeValues,
  finiteValues,
  formatChartValue,
  SPARKLINE_TABLE_WINDOW,
  sparklineGeometry,
} from './shared.ts';

type Props = {
  values: readonly (number | null)[];
  label: string;
  description?: string;
  period?: string;
  variant?: 'line' | 'area' | 'bar';
  format?: ChartFormatSpec;
  /** Formats every visible and accessible value (units such as `%`); wins over `format`. */
  formatValue?: (value: number) => string;
  height?: number;
  showLast?: boolean;
  labels?: Partial<CompactChartLabels>;
};

let {
  values,
  label,
  description,
  period,
  variant = 'line',
  format,
  formatValue: customFormat,
  height = 32,
  showLast = true,
  labels,
}: Props = $props();

const width = 100;
const safeHeight = $derived(Number.isFinite(height) ? Math.max(12, Math.min(120, height)) : 32);
const data = $derived(sparklineGeometry(values, variant, safeHeight, width));

const text = $derived(chartLabels(labels));
const formatValue = (value: number) =>
  customFormat ? customFormat(value) : formatChartValue(value, format);
// Long series render a scroll window of table rows; every row stays reachable by scrolling.
const ROW_HEIGHT = 32;
const windowed = $derived(values.length > SPARKLINE_TABLE_WINDOW);
let scrollTop = $state(0);
let viewportHeight = $state(ROW_HEIGHT * 10);
const rows = $derived(
  windowed
    ? tableWindow(values.length, scrollTop, viewportHeight, ROW_HEIGHT)
    : { start: 0, end: values.length, top: 0, bottom: 0 }
);
const visibleRows = $derived(
  Array.from({ length: rows.end - rows.start }, (_, i) => rows.start + i)
);

function updateWindow(event: Event) {
  const viewport = event.currentTarget;
  if (!(viewport instanceof HTMLElement)) return;
  scrollTop = viewport.scrollTop;
  viewportHeight = viewport.clientHeight || ROW_HEIGHT * 10;
}
const describe = $derived(
  description ??
    `${describeValues(values, formatValue, text.noData)}${period ? ` Period: ${period}.` : ''}`
);
</script>

<figure class="compact-chart">
  <svg direction="ltr" class="sparkline" role="img" aria-label={label} viewBox="0 0 {width} {safeHeight}" preserveAspectRatio="none">
    <title>{label}</title>
    <desc>{describe}</desc>
    {#if variant === 'bar'}
      {#each data.points as point, index (point.index)}
        {#if point.y !== null}
          <rect x={point.x - data.barWidth / 2} y={Math.min(point.y, data.baseline)} width={data.barWidth} height={Math.max(0.5, Math.abs(data.baseline - point.y))} fill="var(--tx-chart-1, currentColor)" opacity={index === data.last ? 1 : 0.58} />
        {/if}
      {/each}
    {:else}
      {#if variant === 'area'}<path d={data.area} fill="var(--tx-chart-1, currentColor)" fill-opacity="0.16" />{/if}
      <path d={data.line} fill="none" stroke="var(--tx-chart-1, currentColor)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    {/if}
    {#if showLast && data.last >= 0}
      {@const last = data.points[data.last]}
      {#if last?.y !== null && last?.y !== undefined}<circle data-marker="last" cx={last.x} cy={last.y} r="2.5" fill="var(--tx-chart-1, currentColor)" vector-effect="non-scaling-stroke" />{/if}
    {/if}
  </svg>
  <details class="tx-chart-mini data-fallback">
    <summary>{text.tableSummary}</summary>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="table-viewport"
      class:windowed
      role={windowed ? 'region' : undefined}
      aria-label={windowed ? label : undefined}
      tabindex={windowed ? 0 : undefined}
      onscroll={windowed ? updateWindow : undefined}
    >
      <table aria-rowcount={values.length + 1} data-row-count={values.length}>
        <caption>{label}{period ? ` — ${period}` : ''}</caption>
        <thead><tr aria-rowindex="1"><th scope="col">{text.point}</th><th scope="col">{text.value}</th></tr></thead>
        <tbody>
          {#if rows.top > 0}<tr aria-hidden="true" class="spacer"><td colspan="2" style:block-size="{rows.top}px"></td></tr>{/if}
          {#each visibleRows as index (index)}
            {@const value = values[index] ?? null}
            <tr aria-rowindex={index + 2}><th scope="row">{index + 1}</th><td>{value === null || !Number.isFinite(value) ? text.noData : formatValue(value)}</td></tr>
          {/each}
          {#if rows.bottom > 0}<tr aria-hidden="true" class="spacer"><td colspan="2" style:block-size="{rows.bottom}px"></td></tr>{/if}
        </tbody>
      </table>
    </div>
  </details>
</figure>

<style>
  .compact-chart { margin: 0; color: var(--tx-foreground, CanvasText); }
  .sparkline { display: block; inline-size: 100%; overflow: visible; color: var(--tx-chart-1, currentColor); }
  .data-fallback { color: var(--tx-foreground, CanvasText); }
  .table-viewport.windowed { max-block-size: 20rem; overflow-y: auto; overscroll-behavior: contain; }
  .table-viewport.windowed tr { block-size: 32px; }
  .table-viewport.windowed .spacer td { border: 0; padding: 0; }
  .table-viewport.windowed:focus-visible { outline: 2px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  @media (forced-colors: active) { .sparkline { forced-color-adjust: auto; } }
</style>
