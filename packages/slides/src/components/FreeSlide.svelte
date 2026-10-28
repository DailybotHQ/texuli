<script lang="ts">
/**
 * The registry's `free` renderer, used only for free slides holding content
 * the stage's core path cannot paint (the resolver checks first):
 *
 * - `{ type: "math", tex }` blocks (Markdown `$$`) → `MathBlock`;
 * - images and figures without `width`/`height` (Markdown `![alt](src)`) →
 *   `MeasuredImage`, sized from the natural size at paint;
 * - `diagram`, `map` and `embed` family blocks → the player, through the
 *   `blocks-*` catalog component of their family.
 *
 * Everything else paints exactly as the stage's own free renderer does
 * (same regions, morph ids, fragments and code highlights).
 */
import type { FreeSlide, SlideItem } from '@texuli/deck/model';
import { extendedItem, withStandInSize } from '../registry/extended.ts';
import { slideStateKey } from '../registry/state.ts';
import BlockRenderer from '../stage/BlockRenderer.svelte';
import { getDeckStepContext } from '../stage/context.ts';
import { composeFreeSlide, type FreeSlideEntry } from '../stage/free.ts';
import RendererHost from '../stage/RendererHost.svelte';
import {
  type DeckLazyRenderer,
  type DeckSlideRenderContext,
  resolveItemRenderer,
} from '../stage/renderers.ts';
import SlidePlaceholder from '../stage/SlidePlaceholder.svelte';
import MathBlock from './MathBlock.svelte';
import MeasuredImage from './MeasuredImage.svelte';

interface Props {
  slide: FreeSlide;
  context: DeckSlideRenderContext;
}

interface NodeProps extends Record<string, unknown> {
  id: string;
  props: Record<string, unknown>;
  context: DeckSlideRenderContext;
  stateKey: string;
  label: string;
}

/** The catalog node painter, imported only when a family block needs the player. */
const catalogNode = {
  load: () => import('./CatalogNode.svelte'),
} as unknown as DeckLazyRenderer<NodeProps>;

let { slide, context }: Props = $props();
const fromContext = getDeckStepContext();
let step = $derived(fromContext ?? context.step);
let extended = $derived(slide.blocks.map((item) => extendedItem(item)));
// Unsized images get stand-in sizes, so the masters still place them as media.
let composed = $derived(
  composeFreeSlide({
    ...slide,
    blocks: slide.blocks.map((item, i) =>
      extended[i]?.kind === 'image' ? (withStandInSize(item) as SlideItem) : item
    ),
  })
);
let morphIds = $derived.by(() => {
  const seen = new Map<string, number>();
  return slide.blocks.map((item) => {
    const n = seen.get(item.type) ?? 0;
    seen.set(item.type, n + 1);
    return `${item.type}-${n}`;
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
  {@const special = extended[entry.index]}
  <div
    class="tx-deck-stage__fragment"
    data-tx-deck-item={entry.index}
    data-tx-deck-morph-id={morphIds[entry.index]}
    data-visible-items={step.visibleItems(path)}
    {...step.attributes(path)}
  >
    {#if special?.kind === 'math'}
      <MathBlock tex={special.tex} />
    {:else if special?.kind === 'image'}
      <MeasuredImage
        block={special.block}
        tier={context.tier}
        t={context.t}
        resolveAvatar={context.resolveAvatar}
      />
    {:else if special?.kind === 'family'}
      <RendererHost
        entry={catalogNode}
        props={{
          id: special.id,
          props: { block: special.block },
          context,
          stateKey: slideStateKey(slide.id, path),
          label: special.id,
        }}
        t={context.t}
      />
    {:else if entry.kind === 'block'}
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
