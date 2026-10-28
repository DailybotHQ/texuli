<script lang="ts">
import {
  type ChartFormatSpec,
  type CompactChartLabels,
  createChartFormatter,
  describeValues,
  formatNumber,
  sparklineGeometry,
} from '../compact/shared.ts';
import { barsPaths } from './paths.ts';

type Props = {
  values: readonly (number | null)[];
  label: string;
  description?: string;
  period?: string;
  variant?: 'line' | 'area' | 'bar';
  format?: ChartFormatSpec;
  /** Formats values in the derived description; wins over `format`. */
  formatValue?: (value: number) => string;
  height?: number;
  showLast?: boolean;
  /** Only `noData` is read (the derived description of an empty series): there is no table to label. */
  labels?: Partial<CompactChartLabels>;
};

let {
  values,
  label,
  description,
  period,
  variant = 'line',
  format,
  formatValue,
  height = 32,
  showLast = true,
  labels,
}: Props = $props();

const width = 100;
const safeHeight = $derived(Number.isFinite(height) ? Math.max(12, Math.min(120, height)) : 32);
const data = $derived(sparklineGeometry(values, variant, safeHeight, width));
// Bars draw as two paths (earlier bars, latest bar), so no element per value.
const bars = $derived(variant === 'bar' ? barsPaths(data) : null);
const last = $derived(showLast ? data.points[data.last] : undefined);
// One formatter per spec change, uncached: no shared formatter cache on the first screen.
const formatter = $derived.by(() => {
  if (!format) return null;
  try {
    return createChartFormatter(format);
  } catch {
    return null;
  }
});
function text(value: number): string {
  if (formatValue) return formatValue(value);
  try {
    return formatter?.format(value) ?? formatNumber(value);
  } catch {
    // A date formatter rejects values outside the representable time range.
    return formatNumber(value);
  }
}
const describe = $derived(
  description ??
    `${describeValues(values, text, labels?.noData ?? 'No data')}${period ? ` Period: ${period}.` : ''}`
);
</script>

<svg direction="ltr" class="tx-sparkline-lite" role="img" aria-label={label} viewBox="0 0 {width} {safeHeight}" preserveAspectRatio="none">
  <title>{label}</title>
  <desc>{describe}</desc>
  {#if bars}
    <path d={bars.rest} fill="var(--tx-chart-1, currentColor)" opacity="0.58" />
    <path d={bars.last} fill="var(--tx-chart-1, currentColor)" />
  {:else}
    {#if variant === 'area'}<path d={data.area} fill="var(--tx-chart-1, currentColor)" fill-opacity="0.16" />{/if}
    <path d={data.line} fill="none" stroke="var(--tx-chart-1, currentColor)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
  {/if}
  {#if last && last.y !== null}<circle data-marker="last" cx={last.x} cy={last.y} r="2.5" fill="var(--tx-chart-1, currentColor)" vector-effect="non-scaling-stroke" />{/if}
</svg>

<style>
  .tx-sparkline-lite { display: block; inline-size: 100%; overflow: visible; color: var(--tx-chart-1, currentColor); }
  @media (forced-colors: active) { .tx-sparkline-lite { forced-color-adjust: auto; } }
</style>
