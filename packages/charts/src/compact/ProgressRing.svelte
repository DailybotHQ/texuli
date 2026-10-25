<script lang="ts">
import { arcPath } from '../math/shapes/arc.ts';
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
  format?: ChartFormatSpec;
  size?: number;
  thickness?: number;
  labels?: Partial<CompactChartLabels>;
};

let {
  label,
  description: customDescription,
  value,
  max = 100,
  format,
  size = 64,
  thickness = 7,
  labels,
}: Props = $props();

const upper = $derived(Number.isFinite(max) && max > 0 ? max : 1);
const current = $derived(clamp(value, 0, upper));
const ratio = $derived(current / upper);
const percent = $derived(Math.round(ratio * 100));
const diameter = $derived(Number.isFinite(size) ? Math.max(24, Math.min(320, size)) : 64);
const ringWidth = $derived(
  Number.isFinite(thickness) ? Math.max(1, Math.min(diameter / 3, thickness)) : 7
);
const radius = $derived(diameter / 2 - ringWidth / 2);
const formatValue = (value: number) => formatChartValue(value, format);
const description = $derived(
  customDescription ?? `${formatValue(current)} of ${formatValue(upper)}; ${percent}%.`
);
const text = $derived(chartLabels(labels));
</script>

<figure class="compact-chart">
  <svg direction="ltr" class="progress-ring" role="img" aria-label={label} viewBox="{-diameter / 2} {-diameter / 2} {diameter} {diameter}">
    <title>{label}</title><desc>{description}</desc>
    <path class="track" d={arcPath({ innerRadius: radius - ringWidth / 2, outerRadius: radius + ringWidth / 2, startAngle: 0, endAngle: Math.PI * 2 })} />
    {#if ratio > 0}<path class="progress" data-progress-arc="" d={arcPath({ innerRadius: radius - ringWidth / 2, outerRadius: radius + ringWidth / 2, startAngle: 0, endAngle: Math.PI * 2 * ratio })} />{/if}
    <text x="0" y="0" text-anchor="middle" dominant-baseline="central" class="percent">{percent}%</text>
  </svg>
  <details class="data-fallback">
    <summary>{text.tableSummary}</summary>
    <table><caption>{label}</caption><thead><tr><th scope="col">{text.measure}</th><th scope="col">{text.value}</th></tr></thead><tbody><tr><th scope="row">{text.complete}</th><td>{formatValue(current)}</td></tr><tr><th scope="row">{text.total}</th><td>{formatValue(upper)}</td></tr><tr><th scope="row">{text.percent}</th><td>{percent}%</td></tr></tbody></table>
  </details>
</figure>

<style>
  .compact-chart { margin: 0; color: var(--tx-foreground, CanvasText); inline-size: fit-content; }
  .progress-ring { display: block; inline-size: min(100%, 8rem); overflow: visible; }
  .track { fill: var(--tx-border, GrayText); opacity: 0.5; }
  .progress { fill: var(--tx-chart-1, currentColor); }
  .percent { fill: var(--tx-foreground, CanvasText); font: 600 0.3em var(--tx-font-sans, system-ui, sans-serif); font-variant-numeric: tabular-nums; }
  .data-fallback { font-size: 0.875rem; }
  table { border-collapse: collapse; inline-size: 100%; }
  th, td { border: 1px solid var(--tx-border, currentColor); padding: 0.25em 0.5em; text-align: start; }
  @media (forced-colors: active) { .track { fill: Canvas; stroke: CanvasText; } .progress { fill: Highlight; } }
</style>
