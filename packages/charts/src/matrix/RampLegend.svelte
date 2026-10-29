<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import { divergingColor, sequentialColor } from '../colors/index.ts';
import { formatMatrixNumber } from './model.ts';
import { type RampLegendLabels, rampLegendLabels, rampLegendText } from './ramp-legend.ts';

/**
 * A labeled color-ramp legend for heatmaps and other matrix charts: the same
 * sequential (or diverging) theme ramp the charts paint with, its title and
 * the values at its ends. Screen readers get one image with the whole
 * sentence ("Weekly volume, color scale from 0 to 120"); the visible text
 * stays text. Colors paint through SVG `fill` attributes (no inline styles,
 * so it is CSP-safe) and keep painting in forced-colors mode.
 */
type Props = {
  /** Visible title and the start of the accessible name. */
  label: string;
  /** Value at the start of the ramp (lightest, or the negative end when diverging). */
  min?: number;
  /** Value at the end of the ramp (darkest, or the positive end when diverging). */
  max?: number;
  /** Text at the start of the ramp; wins over the formatted `min` ("Low"). */
  minLabel?: string;
  /** Text at the end of the ramp; wins over the formatted `max` ("High"). */
  maxLabel?: string;
  /** Which theme ramp to show. Default `sequential`, the heatmap ramp. */
  ramp?: 'sequential' | 'diverging';
  /** Swatches, 2–9 (the ramps have nine steps). Default 9. */
  steps?: number;
  /** Formats `min` and `max` (units such as `%`); the default is the matrix number format. */
  formatValue?: (value: number) => string;
  /** Replaces the derived accessible description after the label. */
  description?: string;
  labels?: Partial<RampLegendLabels>;
  class?: ClassValue;
};

let {
  label,
  min,
  max,
  minLabel,
  maxLabel,
  ramp = 'sequential',
  steps = 9,
  formatValue = formatMatrixNumber,
  description,
  labels,
  class: className = '',
}: Props = $props();

const count = $derived(Number.isFinite(steps) ? Math.min(9, Math.max(2, Math.round(steps))) : 9);
const colors = $derived(
  Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return ramp === 'diverging' ? divergingColor(t * 2 - 1) : sequentialColor(t);
  })
);
const endText = (text: string | undefined, value: number | undefined) =>
  text ?? (value === undefined || !Number.isFinite(value) ? '' : formatValue(value));
const start = $derived(endText(minLabel, min));
const end = $derived(endText(maxLabel, max));
const text = $derived(rampLegendLabels(labels));
const name = $derived(rampLegendText(text, label, start, end, description));
</script>

<div class={cx('tx-ramp-legend', className)} role="img" aria-label={name} data-ramp={ramp} data-steps={count}>
  <span class="tx-ramp-legend__title">{label}</span>
  <svg direction="ltr" class="tx-ramp-legend__bar" viewBox="0 0 {count} 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {#each colors as color, i (i)}
      <rect x={i} y="0" width="1.02" height="1" fill={color} data-step={i} />
    {/each}
  </svg>
  {#if start || end}
    <span class="tx-ramp-legend__ends" aria-hidden="true"><span>{start}</span><span>{end}</span></span>
  {/if}
</div>

<style>
  .tx-ramp-legend {
    display: grid;
    gap: 0.25rem;
    inline-size: min(100%, 16rem);
    min-inline-size: 6rem;
    color: var(--tx-foreground, CanvasText);
    font-family: var(--tx-font-sans, system-ui, sans-serif);
    font-size: 0.8125rem;
  }
  .tx-ramp-legend__title {
    font-weight: 600;
  }
  .tx-ramp-legend__bar {
    display: block;
    inline-size: 100%;
    block-size: 0.75rem;
    border: 1px solid var(--tx-border, currentColor);
    border-radius: 2px;
    forced-color-adjust: none;
  }
  /* The ramp reads in the inline direction, so it flips with the ends on right-to-left pages. */
  .tx-ramp-legend:dir(rtl) .tx-ramp-legend__bar {
    transform: scaleX(-1);
  }
  .tx-ramp-legend__ends {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    color: var(--tx-muted-foreground, GrayText);
    font-variant-numeric: tabular-nums;
  }
  @media (forced-colors: active) {
    .tx-ramp-legend__bar {
      border-color: CanvasText;
    }
  }
</style>
