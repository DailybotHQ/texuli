<script lang="ts">
import type { Block } from '@texuli/blocks/core';
import { composeSlide } from '../model/compose.ts';
import {
  blockFragment,
  type DeckFragment,
  fragmentView,
  isEntranceReveal,
} from '../model/fragments.ts';
import type { DeckSlide, DeckTransition } from '../model/index.ts';
import BlockRenderer from './BlockRenderer.svelte';
import type { DeckMediaTrust } from './media.ts';

interface Props {
  slide: DeckSlide;
  mediaTrust?: DeckMediaTrust;
  resolveAvatar?: (id: string) => string | undefined;
  /** Show a notice for a slide without blocks (off for print). */
  showEmpty?: boolean;
  /** The reveal step to show; omitted, every step shows (the final state). */
  step?: number;
  /**
   * The token that animates the fragments this step revealed, unless a block
   * names its own entrance reveal. `none` (the default) cuts.
   */
  revealTransition?: DeckTransition;
}

let {
  slide,
  mediaTrust = 'untrusted',
  resolveAvatar,
  showEmpty = true,
  step,
  revealTransition = 'none',
}: Props = $props();
let composed = $derived(composeSlide(slide));
const FINAL_STEP = Number.MAX_SAFE_INTEGER;

function revealToken(fragment: DeckFragment): string | undefined {
  if (revealTransition === 'none') return undefined;
  return isEntranceReveal(fragment.reveal) ? fragment.reveal : revealTransition;
}
</script>

<div
  class="tx-deck-stage__regions"
  data-master={composed.master.id}
  data-arrangement={composed.master.arrangement}
  data-slots={composed.regions.map((region) => region.slot).join(' ')}
>
  {#each composed.regions as region (region.slot)}
    <div class="tx-deck-stage__region" data-slot={region.slot}>
      {#each region.blocks as block, index (`${slide.id}:${region.slot}:${block.id ?? index}`)}
        {@render fragmentBlock(block)}
      {:else}
        {#if showEmpty && composed.regions.length === 1}
          <p class="tx-deck-stage__empty">This slide has no content yet.</p>
        {/if}
      {/each}
    </div>
  {/each}
</div>

{#snippet fragmentBlock(block: Block)}
  {@const fragment = blockFragment(block)}
  {#if fragment}
    {@const view = fragmentView(fragment, step ?? FINAL_STEP)}
    <div
      class="tx-deck-stage__fragment"
      data-fragment={fragment.kind}
      data-fragment-step={fragment.step}
      data-fragment-state={view.hidden ? 'hidden' : 'shown'}
      data-visible-items={view.visibleItems}
      data-emphasis={view.emphasized ? fragment.reveal : undefined}
      data-reveal={step !== undefined && view.current ? revealToken(fragment) : undefined}
    >
      <BlockRenderer
        {block}
        {mediaTrust}
        {resolveAvatar}
        hostStep={fragment.kind === 'highlights' ? (step ?? fragment.lastStep) : undefined}
      />
    </div>
  {:else}
    <BlockRenderer {block} {mediaTrust} {resolveAvatar} />
  {/if}
{/snippet}
