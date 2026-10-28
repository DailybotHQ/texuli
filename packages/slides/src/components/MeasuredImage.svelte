<script lang="ts">
/**
 * An image or figure block written without `width` and `height` (Markdown
 * `![alt](src)`): instead of refusing it, the stage measures it at paint.
 * The source passes the media policy at the host's tier first; the image
 * then paints at its natural size (scaled down to its region), and its
 * measured dimensions are set once it loads, so the layout stops shifting.
 * A refused source paints the stage's refusal note; a broken one its alt.
 */
import type { Block } from '@texuli/blocks/core';
import { resolveImageSources } from '@texuli/media/image';
import { type DeckMediaTrust, deckAvatarResolver, gateDeckMedia } from '../stage/media.ts';
import type { DeckTranslate } from '../stage/messages.ts';

interface Props {
  /** The block with stand-in dimensions (see `extendedItem`). */
  block: Block;
  tier: DeckMediaTrust;
  t: DeckTranslate;
  resolveAvatar?: (id: string) => string | undefined;
}

let { block, tier, t, resolveAvatar }: Props = $props();
let gate = $derived(gateDeckMedia(block, { trust: tier, resolveAvatar }));
let avatars = $derived(deckAvatarResolver(resolveAvatar));
// The painted URL is the policy's own output at the tier, never the raw string.
let source = $derived.by(() => {
  const gated = gate.block as { src?: unknown } | null;
  const src = typeof gated?.src === 'string' ? gated.src : undefined;
  if (src === undefined) return undefined;
  if (src.startsWith('avatar:')) return avatars?.(src.slice('avatar:'.length)) ?? undefined;
  return resolveImageSources({ src, trust: tier }).src;
});
let alt = $derived((block as { alt?: string }).alt ?? '');
let caption = $derived((block as { caption?: string }).caption);
let size = $state<{ width: number; height: number } | null>(null);
let broken = $state(false);

function measure(event: Event) {
  const image = event.currentTarget as HTMLImageElement;
  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
    size = { width: image.naturalWidth, height: image.naturalHeight };
  }
}
</script>

{#if !gate.block || !source}
  <p class="tx-deck-stage__media-refused" role="note" data-refused={gate.refused.join(' ')}>
    {t('stage.mediaRefused')}
  </p>
{:else if broken}
  <p class="tx-deck-measured__broken" role="note">{alt}</p>
{:else}
  <figure class="tx-deck-measured" data-tx-deck-measured={size ? 'natural' : 'pending'}>
    <img
      src={source}
      {alt}
      width={size?.width}
      height={size?.height}
      decoding="async"
      onload={measure}
      onerror={() => (broken = true)}
    />
    {#if caption}<figcaption>{caption}</figcaption>{/if}
  </figure>
{/if}

<style>
  .tx-deck-measured {
    margin: 0;
    min-inline-size: 0;
  }
  .tx-deck-measured img {
    display: block;
    max-inline-size: 100%;
    max-block-size: 100%;
    block-size: auto;
    object-fit: contain;
  }
</style>
