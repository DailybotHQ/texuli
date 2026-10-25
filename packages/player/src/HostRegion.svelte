<script lang="ts">
import { onDestroy, untrack } from 'svelte';
import { getPlayerHostRegions, getPlayerLabels } from './context.ts';
import { isHostRegionName } from './region-manifests.ts';

/**
 * Paints a `host-region` node (R21). The host's snippet mounts here with no
 * arguments: the player hands it no blueprint data. A name the host does not
 * provide, or a second node with a name already shown, paints the label as
 * inert text instead.
 */
let { name, label }: { name?: unknown; label?: unknown } = $props();

const labels = getPlayerLabels();
const regions = getPlayerHostRegions();
const owner = {};
// Claimed once, at mount: the first node with a name owns it for its lifetime.
const claimedName = untrack(() => (isHostRegionName(name) ? name : null));
const claimed = claimedName !== null && regions?.claim(claimedName, owner) === true;

onDestroy(() => {
  if (claimed && claimedName !== null) regions?.release(claimedName, owner);
});

const text = $derived(typeof label === 'string' ? label : '');
const host = $derived(claimed && claimedName !== null ? regions?.get(claimedName) : undefined);
</script>

{#if host}
  <div class="tx-player__host-region" role="group" aria-label={text} data-tx-player-host-region={claimedName}>
    {@render host()}
  </div>
{:else}
  <div class="tx-player__host-region" data-tx-player-host-region-missing={claimedName ?? ''}>
    <p>{text}</p>
    <p class="tx-player__host-region-note">
      {claimedName !== null && regions?.get(claimedName) ? labels().hostRegionDuplicate : labels().hostRegionMissing}
    </p>
  </div>
{/if}
