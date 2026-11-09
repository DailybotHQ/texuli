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

<div data-tx-component="charts-area" style="display: contents">
<CartesianChart
  kind="area"
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
