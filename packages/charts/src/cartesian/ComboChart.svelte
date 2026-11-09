<script lang="ts">
import CartesianChart from './CartesianChart.svelte';
import type { CartesianChartProps } from './shared-props.ts';

let {
  title,
  description,
  series,
  mode,
  renderer,
  class: className,
  interactive,
  annotations,
  brushInvert,
  fullDomain,
  visibleDomain,
  onzoom,
  onbrush,
  onselect,
  xKind,
  formatX,
  locale,
  yDomain,
  formatValue,
}: CartesianChartProps = $props();
</script>

<div data-tx-component="charts-combo" class="tx-chart-ds-root">
<CartesianChart
  kind="combo"
  {title}
  {description}
  {series}
  {mode}
  {renderer}
  class={className}
  {interactive}
  {annotations}
  {brushInvert}
  {fullDomain}
  {visibleDomain}
  {onzoom}
  {onbrush}
  {onselect}
  {xKind}
  {formatX}
  {locale}
  {yDomain}
  {formatValue}
/>
</div>

<style>
  /* The design-system root marker (ADR-032) adds no box. */
  .tx-chart-ds-root {
    display: contents;
  }
</style>
