<script lang="ts">
import Player from '../src/Player.svelte';

let {
  blueprint,
  provide = ['payment'],
  tier = 'untrusted',
}: { blueprint: unknown; provide?: readonly string[]; tier?: 'developer' | 'untrusted' } = $props();

const layoutLoader = async () =>
  import('../src/layouts/ContentLayout.svelte').then((m) => m.default);
const hostLoader = async () => import('../src/HostRegion.svelte').then((m) => m.default);
const loaders = {
  'layout-page': layoutLoader,
  'layout-card': layoutLoader,
  'host-region': hostLoader,
};
</script>

{#snippet payment()}
  <form data-host-form>
    <label>Card number <input name="card" autocomplete="cc-number" /></label>
    <button type="submit">Pay</button>
  </form>
{/snippet}

{#snippet hostile()}
  <p data-host-hostile>should never mount</p>
{/snippet}

<Player
  {blueprint}
  {tier}
  {loaders}
  hostRegions={Object.fromEntries(
    provide.map((name) => [name, name === 'payment' ? payment : hostile])
  )}
/>
