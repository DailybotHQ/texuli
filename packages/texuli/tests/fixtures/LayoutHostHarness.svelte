<script lang="ts">
import type { LayoutId } from '../../src/layouts/host/contract.ts';
import LayoutHost from '../../src/layouts/host/LayoutHost.svelte';
import CounterScreen from './CounterScreen.svelte';

let { layout, dir }: { layout: LayoutId; dir?: 'ltr' | 'rtl' } = $props();
</script>

<LayoutHost {layout} {dir}>
  {#snippet children()}
    <CounterScreen />
  {/snippet}
</LayoutHost>
