<script lang="ts">
import type { LayoutId, LayoutOptions } from '../../src/layouts/host/contract.ts';
import LayoutHost from '../../src/layouts/host/LayoutHost.svelte';
import type { NavModel } from '../../src/layouts/host/nav-model.ts';
import CounterScreen from './CounterScreen.svelte';

let {
  layout,
  nav,
  path,
  options,
  dir,
}: {
  layout: LayoutId;
  nav?: NavModel;
  path?: string;
  options?: LayoutOptions;
  dir?: 'ltr' | 'rtl';
} = $props();
</script>

<LayoutHost {layout} {nav} {path} {options} {dir}>
  {#snippet children()}
    <CounterScreen />
  {/snippet}
</LayoutHost>
