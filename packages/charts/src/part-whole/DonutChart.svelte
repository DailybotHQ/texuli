<script lang="ts">
import type { ComponentProps } from 'svelte';
import PieChart from './PieChart.svelte';

let props: ComponentProps<typeof PieChart> = $props();
</script>

<div data-tx-component="charts-donut" style="display: contents">
  <PieChart {...props} innerRatio={props.innerRatio ?? 0.58} />
</div>
