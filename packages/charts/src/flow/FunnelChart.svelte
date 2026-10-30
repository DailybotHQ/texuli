<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import { fitChartWidth } from '../math/layout/fit-width.ts';
import FlowDataTable from './FlowDataTable.svelte';
import {
  type FlowChartLabels,
  type FunnelStepInput,
  flowChartLabels,
  flowColor,
  formatFlowPercent,
  formatFlowValue,
  funnelLayout,
} from './model.ts';

type Props = {
  title: string;
  description?: string;
  steps: readonly FunnelStepInput[];
  orientation?: 'vertical' | 'horizontal';
  width?: number;
  height?: number;
  labels?: Partial<FlowChartLabels>;
  class?: ClassValue;
};

let {
  title,
  description: customDescription,
  steps,
  orientation = 'vertical',
  width: preferredWidth = 640,
  height = 320,
  labels,
  class: className,
}: Props = $props();

// Lays out at the figure's measured width, up to `width` (the preferred width).
let measuredWidth = $state(0);
const width = $derived(fitChartWidth(measuredWidth, preferredWidth));
const uid = $props.id();
const text = $derived(flowChartLabels(labels));
const validDimensions = $derived(
  Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
);
const layout = $derived(
  validDimensions ? funnelLayout(steps, { width, height, orientation, gap: 8 }) : []
);
const summary = $derived(
  customDescription ??
    `${title}: ${formatFlowValue(steps[0]?.value ?? 0)} entered; ${formatFlowValue(steps.at(-1)?.value ?? 0)} reached ${steps.at(-1)?.label ?? 'the final step'}.`
);
</script>

<figure class={cx('flow-chart', className)}>
  <figcaption><h3>{title}</h3><p>{summary}</p></figcaption>
  <!-- Zero-height width probe: it tracks the figure width, and the chart re-laying out (its height) never re-notifies it. -->
  <div class="tx-chart-width-probe" aria-hidden="true" bind:clientWidth={measuredWidth}></div>
  {#if validDimensions}
    <svg direction="ltr" class="flow-svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="{uid}-title" aria-describedby="{uid}-description">
      <title id="{uid}-title">{title}</title>
      <desc id="{uid}-description">{summary}</desc>
      {#each layout as step, index (step.id)}
        <rect data-step={step.id} x={step.x} y={step.y} width={step.width} height={step.height} rx="3" fill={flowColor(index)} />
        <text x={orientation === 'vertical' ? width / 2 : step.x + step.width / 2} y={orientation === 'vertical' ? step.y + step.height / 2 : height - 8} text-anchor="middle" dominant-baseline="middle">{step.label ?? step.id}: {formatFlowValue(step.value)} ({formatFlowPercent(step.conversion)})</text>
      {/each}
    </svg>
    <FlowDataTable
      title={title}
      summary={text.tableSummary}
      headers={[text.step, text.count, text.conversion]}
      rows={layout.map((step) => ({ id: step.id, cells: [step.label ?? step.id, step.value, formatFlowPercent(step.conversion)] }))}
    />
  {:else}
    <p role="alert">Chart width and height must be finite and greater than zero.</p>
  {/if}
</figure>

<style>
  .flow-chart { color: var(--tx-foreground, CanvasText); margin: 0; max-inline-size: 100%; }
  figcaption h3 { font-size: var(--tx-type-body-size); margin-block: 0; }
  figcaption p { color: var(--tx-muted-foreground, CanvasText); margin-block: var(--tx-space-1) var(--tx-space-3); }
  .flow-svg { display: block; inline-size: 100%; max-block-size: 32rem; overflow: visible; }
  /* Token-sized labels: the chart lays out at its drawn width, so user units are pixels. */
  .flow-svg text { fill: var(--tx-foreground, CanvasText); font: var(--tx-type-caption-size) var(--tx-font-sans, system-ui, sans-serif); }
  @media (forced-colors: active) { .flow-svg rect { fill: Canvas; stroke: CanvasText; stroke-width: 2; } }
  @media (forced-colors: active) {
    figcaption h3, figcaption p { color: CanvasText; }
  }
</style>
