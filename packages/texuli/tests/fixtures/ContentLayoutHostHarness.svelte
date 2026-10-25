<script lang="ts">
import type { LayoutId, LayoutOptions } from '../../src/layouts/host/contract.ts';
import LayoutHost from '../../src/layouts/host/LayoutHost.svelte';
import type { NavModel } from '../../src/layouts/host/nav-model.ts';

let {
  layout,
  dir,
  options,
  nav,
}: {
  layout: LayoutId;
  dir: 'ltr' | 'rtl';
  options: LayoutOptions;
  nav: NavModel;
} = $props();
</script>

<LayoutHost {layout} {dir} {options} {nav} path="/guide">
  {#snippet children()}
    <p>Start with the reader’s question and give the answer a clear place to live.</p>
    <h2 id="reader-first">Reader first</h2>
    <p>Use familiar words and a stable structure.</p>
    <h3>Keep the route visible</h3>
    <p>Offer landmarks that work on a narrow screen too.</p>
    <h2>Make space</h2>
    <p>Give long-form text enough breathing room.</p>
  {/snippet}
</LayoutHost>
