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
}: CartesianChartProps = $props();
</script>

<CartesianChart
  kind="stacked-bar"
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
/>
