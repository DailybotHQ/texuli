<script lang="ts">
/** `image-centered` and `video-centered`: one image or video is the focus, with a caption. */
import type { DeckSlideRenderContext } from '../stage/renderers.ts';
import { fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import LayoutImage from './LayoutImage.svelte';
import LayoutVideo from './LayoutVideo.svelte';
import { layoutMessage } from './messages.ts';
import { type LayoutSlideOf, useLayoutSteps } from './steps.ts';

interface Props {
  slide: LayoutSlideOf<'image-centered'> | LayoutSlideOf<'video-centered'>;
  context: DeckSlideRenderContext;
}

let { slide, context }: Props = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
let image = $derived('image' in slide.props ? slide.props.image : undefined);
let video = $derived('video' in slide.props ? slide.props.video : undefined);
</script>

<LayoutFrame layout={slide.layout} root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <div class="stage" data-slot="focus">
    {#if image}
      <LayoutImage {image} {context} fit="contain" step={steps.at(['image'])} />
    {:else if video}
      <LayoutVideo
        {video}
        {context}
        fallbackLabel={p.title ?? slide.title ?? layoutMessage('layout.video')}
        step={steps.at(['video'])}
      />
    {/if}
  </div>
  {#if p.caption}
    <p class="tx-deck-layout__caption caption" data-slot="caption">{p.caption}</p>
  {/if}
</LayoutFrame>

<style>
  .stage {
    display: grid;
    flex: 1;
    min-block-size: 0;
  }

  .stage :global(.tx-deck-layout__media) {
    block-size: 100%;
  }

  .caption {
    text-align: center;
  }
</style>
