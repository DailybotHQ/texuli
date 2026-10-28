<script lang="ts">
/**
 * A layout image: the `@texuli/media` `Image` at the host's URL-policy tier,
 * filling its frame (`cover`) or fitting inside it (`contain`). A refused
 * source (or an avatar id without a host adapter) shows the stage's
 * refused-media notice in the frame instead.
 */
import { Image } from '@texuli/media/image';
import type { DeckSlideRenderContext } from '../stage/renderers.ts';
import type { DeckFragmentAttributes } from '../stage/steps.ts';
import { layoutImageSrc } from './media.ts';

interface Props {
  image: { src: string; alt: string };
  context: DeckSlideRenderContext;
  fit?: 'cover' | 'contain';
  /** Fragment attributes of the image props object. */
  step?: DeckFragmentAttributes;
  slot?: string;
}

let { image, context, fit = 'cover', step = {}, slot = 'media' }: Props = $props();
let src = $derived(layoutImageSrc(image.src, context.tier, context.resolveAvatar));
// Avatars resolved by the host were checked at the developer tier.
let trust = $derived(src !== undefined && src !== image.src ? 'developer' : context.tier);
</script>

<figure class="tx-deck-layout__media" data-slot={slot} data-fit={fit} {...step}>
  {#if src}
    <Image {src} alt={image.alt} {fit} {trust} loading="eager" />
  {:else}
    <p class="tx-deck-layout__refused" role="note" data-refused="src">
      {context.t('stage.mediaRefused')}
    </p>
  {/if}
</figure>

<style>
  figure {
    margin: 0;
  }
</style>
