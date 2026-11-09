<script lang="ts">
import type { ComponentProps } from 'svelte';
import PieChart from './PieChart.svelte';

let props: ComponentProps<typeof PieChart> = $props();
</script>

<div data-tx-component="charts-donut" class="tx-chart-ds-root">
  <PieChart {...props} innerRatio={props.innerRatio ?? 0.58} />
</div>

<style>
  /* The design-system root marker (ADR-032) adds no box. */
  .tx-chart-ds-root {
    display: contents;
  }
</style>
