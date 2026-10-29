<script lang="ts">
import { gaugeLabelSizes, gaugeLayout } from '../math/layout/gauge.ts';
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
  min?: number;
  max?: number;
  thresholds?: readonly number[];
  bandLabels?: readonly string[];
  format?: ChartFormatSpec;
  /** Formats every visible and accessible value (units such as `%`); wins over `format`. */
  formatValue?: (value: number) => string;
  size?: number;
  thickness?: number;
  labels?: Partial<CompactChartLabels>;
};

let {
  label,
  description: customDescription,
  value,
  min = 0,
  max = 100,
  thresholds = [],
  bandLabels = [],
  format,
  formatValue: customFormat,
  size = 144,
  thickness = 12,
  labels,
}: Props = $props();

const rangeMin = $derived(Number.isFinite(min) ? min : 0);
const rangeMax = $derived(Number.isFinite(max) && max > rangeMin ? max : rangeMin + 1);
const safeValue = $derived(clamp(value, rangeMin, rangeMax));
const layout = $derived(gaugeLayout(safeValue, { min: rangeMin, max: rangeMax, thresholds }));
const diameter = $derived(Number.isFinite(size) ? Math.max(64, Math.min(320, size)) : 144);
const radius = $derived(diameter / 2 - 7);
const ringWidth = $derived(
  Number.isFinite(thickness) ? Math.max(2, Math.min(radius * 0.6, thickness)) : 12
);
const band = $derived(layout.bands[layout.band]);
// Label sizes in user units, so they scale with the viewBox (see gaugeLabelSizes).
const labelSizes = $derived(gaugeLabelSizes(diameter));
const bandLabel = $derived(bandLabels[layout.band] ?? '');
const formatValue = (value: number) =>
  customFormat ? customFormat(value) : formatChartValue(value, format);
const description = $derived(
  customDescription ??
    `${formatValue(safeValue)} of ${formatValue(rangeMax)}${bandLabel ? `; ${bandLabel}` : ''}.`
);
const text = $derived(chartLabels(labels));
</script>

<figure class="compact-chart">
  <svg direction="ltr" class="gauge" role="img" aria-label={label} viewBox="{-diameter / 2} {-diameter / 2} {diameter} {diameter}">
    <title>{label}</title><desc>{description}</desc>
    <path class="track" d={arcPath({ innerRadius: radius - ringWidth, outerRadius: radius, startAngle: layout.track.startAngle, endAngle: layout.track.endAngle })} />
    {#each layout.bands as item (item.index)}
      <path class="band band-{item.index % 3}" data-band={item.index} d={arcPath({ innerRadius: radius + 2, outerRadius: radius + 5, startAngle: item.startAngle, endAngle: item.endAngle, padAngle: 0.025 })} />
    {/each}
    {#if layout.ratio > 0}<path class="value" data-value-arc="" d={arcPath({ innerRadius: radius - ringWidth, outerRadius: radius, startAngle: layout.track.startAngle, endAngle: layout.angle, cornerRadius: ringWidth / 2 })} />{/if}
    <text x="0" y={labelSizes.value.y} font-size={labelSizes.value.fontSize} text-anchor="middle" class="value-label">{formatValue(safeValue)}</text>
    {#if bandLabel}<text x="0" y={labelSizes.band.y} font-size={labelSizes.band.fontSize} text-anchor="middle" class="band-label">{bandLabel}</text>{/if}
  </svg>
  <details class="data-fallback">
    <summary>{text.tableSummary}</summary>
    <table><caption>{label}</caption><thead><tr><th scope="col">{text.measure}</th><th scope="col">{text.value}</th></tr></thead><tbody>
      <tr><th scope="row">{text.current}</th><td>{formatValue(safeValue)}</td></tr><tr><th scope="row">{text.minimum}</th><td>{formatValue(rangeMin)}</td></tr><tr><th scope="row">{text.maximum}</th><td>{formatValue(rangeMax)}</td></tr>{#if bandLabel}<tr><th scope="row">{text.range}</th><td>{bandLabel}</td></tr>{/if}
    </tbody></table>
  </details>
</figure>

<style>
  .compact-chart { margin: 0; color: var(--tx-foreground, CanvasText); inline-size: fit-content; }
  .gauge { display: block; inline-size: min(100%, 12rem); overflow: visible; }
  .track { fill: var(--tx-border, GrayText); opacity: 0.45; }
  .band-0 { fill: var(--tx-chart-2, GrayText); }
  .band-1 { fill: var(--tx-chart-3, GrayText); }
  .band-2 { fill: var(--tx-chart-4, GrayText); }
  .value { fill: var(--tx-chart-1, currentColor); }
  /* No font-size here: it is the text's font-size attribute, in user units (CSS would override it). */
  .value-label { fill: var(--tx-foreground, CanvasText); font-family: var(--tx-font-sans, system-ui, sans-serif); font-weight: 600; font-variant-numeric: tabular-nums; }
  .band-label { fill: var(--tx-muted-foreground, GrayText); font-family: var(--tx-font-sans, system-ui, sans-serif); }
  .data-fallback { font-size: 0.875rem; }
  table { border-collapse: collapse; inline-size: 100%; }
  th, td { border: 1px solid var(--tx-border, currentColor); padding: 0.25em 0.5em; text-align: start; }
  @media (forced-colors: active) { .track { fill: Canvas; stroke: CanvasText; } .band { fill: Canvas; stroke: CanvasText; stroke-dasharray: 2 2; } .value { fill: Highlight; } }
</style>
