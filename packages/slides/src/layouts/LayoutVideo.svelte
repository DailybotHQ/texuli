<script lang="ts">
/**
 * A layout video: the `@texuli/media` `VideoPlayer` (keyboard controls,
 * captions-ready) at the host's URL-policy tier. Autoplay is never forced: a
 * presenter starts the clip. A refused source shows the stage's
 * refused-media notice instead.
 */
import { VideoPlayer } from '@texuli/media/video';
import type { DeckSlideRenderContext } from '../stage/renderers.ts';
import type { DeckFragmentAttributes } from '../stage/steps.ts';
import { layoutVideoSrc } from './media.ts';

interface Props {
  video: { src: string; label?: string; loop?: boolean; muted?: boolean };
  context: DeckSlideRenderContext;
  /** Accessible name when the author gave no `label`. */
  fallbackLabel: string;
  step?: DeckFragmentAttributes;
}

let { video, context, fallbackLabel, step = {} }: Props = $props();
let src = $derived(layoutVideoSrc(video.src, context.tier).src);
</script>

<div class="tx-deck-layout__media" data-slot="media" data-fit="contain" {...step}>
  {#if src}
    <VideoPlayer
      {src}
      title={video.label ?? fallbackLabel}
      trust={context.tier}
      loop={video.loop ?? false}
      muted={video.muted ?? false}
      playsInline
    />
  {:else}
    <p class="tx-deck-layout__refused" role="note" data-refused="src">
      {context.t('stage.mediaRefused')}
    </p>
  {/if}
</div>
