<script lang="ts">
/**
 * `image-full-bleed`: the image is the message, edge to edge. The caption
 * sits on a solid band in the slide's own ink and background tokens, so it
 * stays readable over any photo; `overlay` darkens or lightens the image.
 */
import LayoutFrame from './LayoutFrame.svelte';
import LayoutImage from './LayoutImage.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'image-full-bleed'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
</script>

<LayoutFrame layout="image-full-bleed" root={steps.at([])} bleed="edge">
  <div class="bleed" data-overlay={p.overlay ?? 'none'}>
    <LayoutImage image={p.image} {context} step={steps.at(['image'])} />
    {#if p.caption || p.credit}
      <div class="band" data-slot="caption">
        {#if p.caption}
          <p class="tx-deck-layout__lead caption">{p.caption}</p>
        {/if}
        {#if p.credit}
          <p class="tx-deck-layout__caption" data-slot="credit">{p.credit}</p>
        {/if}
      </div>
    {/if}
  </div>
</LayoutFrame>

<style>
  .bleed {
    position: relative;
    display: grid;
    inline-size: 100%;
    block-size: 100%;
  }

  .bleed :global(.tx-deck-layout__media) {
    border-radius: 0;
  }

  .bleed[data-overlay="dark"] :global(.tx-deck-layout__media)::after,
  .bleed[data-overlay="light"] :global(.tx-deck-layout__media)::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
  }

  .bleed[data-overlay="light"] :global(.tx-deck-layout__media)::after {
    background: rgb(255 255 255 / 0.45);
  }

  .band {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-block: clamp(20px, 2.6cqi, 36px);
    padding-inline: var(--tx-deck-layout-pad-inline);
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
  }

  .caption {
    font-weight: 600;
  }
</style>
