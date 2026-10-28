<script lang="ts">
/**
 * The stage's built-in renderer for `free` slides: the slide title, then its
 * blocks in the master's regions (reading order, never reordered visually).
 * Blocks paint through the v1 `BlockRenderer` path (lazy block families, the
 * media URL policy at the host tier); component items ask the renderer list
 * (`item`) and fall back to a labelled placeholder. Each top-level item reads
 * its fragment phase from the step context (`getDeckStepContext()`).
 *
 * Morph (auto-animate) keys: the title is `title`, each item `<type>-<n>`
 * (the n-th item of that type on the slide), so consecutive `morph` slides
 * pair their titles, first images, first charts… like reveal.js.
 */
import type { FreeSlide } from '@texuli/deck/model';
import BlockRenderer from './BlockRenderer.svelte';
import { getDeckStepContext } from './context.ts';
import { composeFreeSlide, type FreeSlideEntry } from './free.ts';
import RendererHost from './RendererHost.svelte';
import { type DeckSlideRenderContext, resolveItemRenderer } from './renderers.ts';
import SlidePlaceholder from './SlidePlaceholder.svelte';

interface Props {
  slide: FreeSlide;
  context: DeckSlideRenderContext;
}

let { slide, context }: Props = $props();
const fromContext = getDeckStepContext();
let step = $derived(fromContext ?? context.step);
let composed = $derived(composeFreeSlide(slide));
let morphIds = $derived.by(() => {
  const seen = new Map<string, number>();
  return slide.blocks.map((item) => {
    const type = item.type;
    const n = seen.get(type) ?? 0;
    seen.set(type, n + 1);
    return `${type}-${n}`;
  });
});
let lookup = $derived({ tier: context.tier });
</script>

{#if slide.title}
  <h2 class="tx-deck-stage__slide-title" data-tx-deck-morph-id="title">{slide.title}</h2>
{/if}
<div
  class="tx-deck-stage__regions"
  data-master={composed.master.id}
  data-arrangement={composed.master.arrangement}
  data-slots={composed.regions.map((region) => region.slot).join(' ')}
>
  {#each composed.regions as region (region.slot)}
    <div class="tx-deck-stage__region" data-slot={region.slot}>
      {#each region.entries as entry (entry.index)}
        {@render item(entry)}
      {/each}
    </div>
  {/each}
</div>

{#snippet item(entry: FreeSlideEntry)}
  {@const path = ['blocks', entry.index]}
  {@const highlight = step.codeHighlight(path)}
  <div
    class="tx-deck-stage__fragment"
    data-tx-deck-item={entry.index}
    data-tx-deck-morph-id={morphIds[entry.index]}
    data-visible-items={step.visibleItems(path)}
    {...step.attributes(path)}
  >
    {#if entry.kind === 'block'}
      <BlockRenderer
        block={entry.block}
        mediaTrust={context.tier}
        resolveAvatar={context.resolveAvatar}
        hostStep={entry.block.type === 'code' ? (highlight?.index ?? 0) : undefined}
        t={context.t}
      />
    {:else if entry.kind === 'component'}
      {@const renderer = resolveItemRenderer(context.renderers, entry.item, lookup)}
      {#if renderer}
        <RendererHost entry={renderer} props={{ item: entry.item, path, context }} t={context.t} />
      {:else}
        <SlidePlaceholder t={context.t} component={entry.item.component} />
      {/if}
    {:else}
      <p class="tx-deck-stage__error" role="note">{context.t('layout.contentUnavailable')}</p>
    {/if}
  </div>
{/snippet}
