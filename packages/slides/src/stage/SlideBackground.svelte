<script lang="ts">
/**
 * Paints a resolved deck background as layers, bottom to top: the base color
 * and gradient or pattern (from the `--tx-deck-bg-*` variables on the slide),
 * an image or a muted looping video, then the contrast scrim. Media sources
 * pass the URL policy at the host's tier right here; a refused source paints
 * nothing (the base color and scrim still guarantee the text contrast).
 * Backgrounds are decorative: the layer stack is hidden from assistive tech.
 */
import type { DeckBackgroundLayer, ResolvedDeckBackground } from '@texuli/deck/model';
import { resolveImageSources } from '@texuli/media/image';
import { resolveVideoSources } from '@texuli/media/video';
import type { DeckMediaTrust } from './media.ts';

interface Props {
  background: ResolvedDeckBackground;
  tier: DeckMediaTrust;
}

let { background, tier }: Props = $props();

type MediaLayer = Extract<DeckBackgroundLayer, { type: 'media' }>;

let media = $derived(
  background.layers.find((layer): layer is MediaLayer => layer.type === 'media')
);
let pattern = $derived(
  background.layers.find((layer) => layer.type === 'pattern') as
    | Extract<DeckBackgroundLayer, { type: 'pattern' }>
    | undefined
);
let image = $derived(
  media?.media === 'image' ? resolveImageSources({ src: media.src, trust: tier }).src : undefined
);
let video = $derived(
  media?.media === 'video'
    ? resolveVideoSources({ src: media.src, poster: media.poster, trust: tier })
    : undefined
);
</script>

<div
  class="tx-deck-stage__background"
  data-tx-deck-bg={background.kind}
  data-tx-deck-bg-preset={background.preset}
  data-tx-deck-pattern={pattern?.pattern}
  data-tx-deck-bg-refused={media && !image && !video?.src ? 'src' : undefined}
  aria-hidden="true"
>
  {#if media && image}
    <img
      class="tx-deck-stage__background-media"
      src={image}
      alt=""
      decoding="async"
      data-fit={media.fit}
      data-position={media.position}
      data-full={media.full ? 'true' : undefined}
    />
  {:else if media && video?.src}
    <video
      class="tx-deck-stage__background-media"
      src={video.src}
      poster={video.poster}
      muted
      autoplay
      loop
      playsinline
      preload="metadata"
      tabindex="-1"
      data-fit={media.fit}
      data-position={media.position}
      data-full={media.full ? 'true' : undefined}
    ></video>
  {/if}
  {#if background.scrim > 0}
    <div class="tx-deck-stage__scrim" data-tx-deck-scrim={background.scrim}></div>
  {/if}
</div>
