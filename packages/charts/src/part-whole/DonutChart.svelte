<script lang="ts">
import type { ComponentProps } from 'svelte';
import PieChart from './PieChart.svelte';

let props: ComponentProps<typeof PieChart> = $props();
</script>

<PieChart {...props} innerRatio={props.innerRatio ?? 0.58} />
