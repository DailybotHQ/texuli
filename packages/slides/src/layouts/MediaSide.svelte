<script lang="ts">
/**
 * `image-left`, `image-right`, `video-left` and `video-right`: a media pane
 * beside the copy. Reading order follows the layout name (media first for
 * `-left`), and the panes mirror with `dir="rtl"` because the grid follows
 * the inline direction.
 */
import type { DeckSlideRenderContext } from '../stage/renderers.ts';
import { fitContent, fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import LayoutImage from './LayoutImage.svelte';
import LayoutVideo from './LayoutVideo.svelte';
import { layoutMessage } from './messages.ts';
import { type LayoutSlideOf, useLayoutSteps } from './steps.ts';

interface Props {
  slide:
    | LayoutSlideOf<'image-left'>
    | LayoutSlideOf<'image-right'>
    | LayoutSlideOf<'video-left'>
    | LayoutSlideOf<'video-right'>;
  context: DeckSlideRenderContext;
}

let { slide, context }: Props = $props();
const steps = useLayoutSteps(() => context);
let mediaFirst = $derived(slide.layout.endsWith('-left'));
let image = $derived('image' in slide.props ? slide.props.image : undefined);
let video = $derived('video' in slide.props ? slide.props.video : undefined);
let p = $derived(slide.props);
</script>

<LayoutFrame layout={slide.layout} root={steps.at([])} bleed="edge">
  <div class="split" data-media-first={mediaFirst ? 'true' : 'false'}>
    {#if mediaFirst}
      {@render media()}
      {@render copy()}
    {:else}
      {@render copy()}
      {@render media()}
    {/if}
  </div>
</LayoutFrame>

{#snippet media()}
  <div class="pane pane--media">
    {#if image}
      <LayoutImage {image} {context} step={steps.at(['image'])} />
    {:else if video}
      <LayoutVideo
        {video}
        {context}
        fallbackLabel={p.heading ?? p.title ?? slide.title ?? layoutMessage('layout.video')}
        step={steps.at(['video'])}
      />
    {/if}
  </div>
{/snippet}

{#snippet copy()}
  <div class="pane pane--copy" data-slot="copy" {@attach fitContent()}>
    {#if p.title}
      <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="3" {@attach fitText(40)}>
        {p.title}
      </h2>
    {/if}
    <span class="tx-deck-layout__accent" aria-hidden="true"></span>
    {#if p.heading}
      <h3 class="tx-deck-layout__lead heading" data-slot="heading">{p.heading}</h3>
    {/if}
    <p class="tx-deck-layout__text" data-slot="body">{p.body}</p>
  </div>
{/snippet}

<style>
  .split {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    inline-size: 100%;
    block-size: 100%;
  }

  .split[data-media-first="false"] {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  }

  .pane {
    min-inline-size: 0;
    min-block-size: 0;
  }

  .pane--media {
    display: grid;
    padding: clamp(24px, 3cqi, 48px);
  }

  .pane--media :global(.tx-deck-layout__media) {
    block-size: 100%;
  }

  .pane--copy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(14px, 1.8cqi, 24px);
    padding-block: var(--tx-deck-layout-pad-block);
    padding-inline: clamp(32px, 4cqi, 64px);
  }

  .split[data-media-first="false"] .pane--copy {
    padding-inline-start: var(--tx-deck-layout-pad-inline);
  }

  .split[data-media-first="true"] .pane--copy {
    padding-inline-end: var(--tx-deck-layout-pad-inline);
  }

  .heading {
    font-weight: 600;
    font-family: var(--tx-font-heading, inherit);
  }

  @container (max-inline-size: 48rem) {
    .split,
    .split[data-media-first="false"] {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
    }

    .pane--copy {
      padding-block-start: 0;
      padding-inline: var(--tx-deck-layout-pad-inline);
    }

    .split[data-media-first="false"] .pane--media {
      grid-row: 1;
    }
  }
</style>
