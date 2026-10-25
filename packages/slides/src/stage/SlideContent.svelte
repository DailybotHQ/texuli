<script lang="ts">
import { composeSlide } from '../model/compose.ts';
import type { DeckSlide } from '../model/index.ts';
import BlockRenderer from './BlockRenderer.svelte';
import type { DeckMediaTrust } from './media.ts';

interface Props {
  slide: DeckSlide;
  mediaTrust?: DeckMediaTrust;
  resolveAvatar?: (id: string) => string | undefined;
  /** Show a notice for a slide without blocks (off for print). */
  showEmpty?: boolean;
}

let { slide, mediaTrust = 'untrusted', resolveAvatar, showEmpty = true }: Props = $props();
let composed = $derived(composeSlide(slide));
</script>

<div
  class="tx-deck-stage__regions"
  data-master={composed.master.id}
  data-arrangement={composed.master.arrangement}
>
  {#each composed.regions as region (region.slot)}
    <div class="tx-deck-stage__region" data-slot={region.slot}>
      {#each region.blocks as block, index (`${slide.id}:${region.slot}:${block.id ?? index}`)}
        <BlockRenderer {block} {mediaTrust} {resolveAvatar} />
      {:else}
        {#if showEmpty && composed.regions.length === 1}
          <p class="tx-deck-stage__empty">This slide has no content yet.</p>
        {/if}
      {/each}
    </div>
  {/each}
</div>
