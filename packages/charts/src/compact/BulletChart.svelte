<script lang="ts">
import {
  type ChartFormatSpec,
  type CompactChartLabels,
  chartLabels,
  clamp,
  formatChartValue,
} from './shared.ts';

type Props = {
  label: string;
  description?: string;
  value: number;
  max?: number;
  target?: number;
  ranges?: readonly number[];
  format?: ChartFormatSpec;
  /** Formats every visible and accessible value (units such as `%`); wins over `format`. */
  formatValue?: (value: number) => string;
  labels?: Partial<CompactChartLabels>;
};

let {
  label,
  description: customDescription,
  value,
  max = 100,
  target,
  ranges = [],
  format,
  formatValue: customFormat,
  labels,
}: Props = $props();

const upper = $derived(Number.isFinite(max) && max > 0 ? max : 100);
const safeValue = $derived(clamp(value, 0, upper));
const safeTarget = $derived(
  target === undefined || !Number.isFinite(target) ? null : clamp(target, 0, upper)
);
const stops = $derived(
  [...new Set(ranges.filter((point) => Number.isFinite(point) && point > 0 && point < upper))].sort(
    (a, b) => a - b
  )
);
const segments = $derived(
  [0, ...stops, upper]
    .slice(0, -1)
    .map((start, index) => ({ start, end: [0, ...stops, upper][index + 1] as number }))
);
const text = $derived(chartLabels(labels));
const formatValue = (value: number) =>
  customFormat ? customFormat(value) : formatChartValue(value, format);
const description = $derived(
  customDescription ??
    `${formatValue(safeValue)} of ${formatValue(upper)}${safeTarget === null ? '' : `; ${text.target.toLowerCase()} ${formatValue(safeTarget)}`}.`
);
</script>

<figure class="bullet-chart">
  <svg direction="ltr" role="img" aria-label={label} viewBox="0 0 100 24" preserveAspectRatio="none">
    <title>{label}</title><desc>{description}</desc>
    {#each segments as segment, index (index)}
      <rect class="range range-{index % 3}" data-range={index} x={segment.start / upper * 100} y="4" width={(segment.end - segment.start) / upper * 100} height="16" />
    {/each}
    <rect class="measure" x="0" y="8" width={safeValue / upper * 100} height="8" />
    {#if safeTarget !== null}<line data-target="" x1={safeTarget / upper * 100} x2={safeTarget / upper * 100} y1="2" y2="22" />{/if}
  </svg>
  <details class="data-fallback">
    <summary>{text.tableSummary}</summary>
    <table><caption>{label}</caption><thead><tr><th scope="col">{text.measure}</th><th scope="col">{text.value}</th></tr></thead>
      <tbody><tr><th scope="row">{text.current}</th><td>{formatValue(safeValue)}</td></tr><tr><th scope="row">{text.maximum}</th><td>{formatValue(upper)}</td></tr>{#if safeTarget !== null}<tr><th scope="row">{text.target}</th><td>{formatValue(safeTarget)}</td></tr>{/if}</tbody>
    </table>
  </details>
</figure>

<style>
  .bullet-chart { margin: 0; color: var(--tx-foreground, CanvasText); }
  svg { display: block; inline-size: 100%; block-size: 1.5rem; overflow: visible; }
  .range { opacity: 0.2; }
  .range-0 { fill: var(--tx-chart-sequential-3, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 38%, var(--tx-background, Canvas))); }
  .range-1 { fill: var(--tx-chart-sequential-6, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 68%, var(--tx-background, Canvas))); }
  .range-2 { fill: var(--tx-chart-sequential-9, color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) 98%, var(--tx-background, Canvas))); }
  .measure { fill: var(--tx-chart-1, currentColor); }
  line { stroke: var(--tx-foreground, CanvasText); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .data-fallback { font-size: 0.875rem; }
  table { border-collapse: collapse; inline-size: 100%; }
  th, td { border: 1px solid var(--tx-border, currentColor); padding: 0.25em 0.5em; text-align: start; }
  @media (forced-colors: active) { .range { fill: Canvas; stroke: CanvasText; stroke-dasharray: 2 2; opacity: 1; } .measure { fill: Highlight; } line { stroke: CanvasText; } }
</style>
