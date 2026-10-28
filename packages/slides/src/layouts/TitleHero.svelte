<script lang="ts">
/** `title-hero`: the cover. Title, optional subtitle and a meta line at the foot. */
import { fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'title-hero'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
</script>

<LayoutFrame layout="title-hero" root={steps.at([])}>
  <div class="decor" aria-hidden="true" data-tx-deck-decor>
    <span class="orb orb--large"></span>
    <span class="orb orb--small"></span>
  </div>
  <div class="hero" data-slot="hero">
    <span class="tx-deck-layout__accent" aria-hidden="true"></span>
    <h1 class="tx-deck-layout__display" data-slot="title" data-clamp="3" {@attach fitText(56)}>
      {p.title}
    </h1>
    {#if p.subtitle}
      <p class="tx-deck-layout__lead subtitle" data-slot="subtitle" data-clamp="2">{p.subtitle}</p>
    {/if}
  </div>
  {#if p.meta}
    <p class="tx-deck-layout__label meta" data-slot="meta">{p.meta}</p>
  {/if}
</LayoutFrame>

<style>
  .decor {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    background: color-mix(in oklch, var(--tx-deck-accent) 16%, transparent);
    filter: blur(48px);
  }

  .orb--large {
    inset-block-start: -22cqi;
    inset-inline-end: -14cqi;
    inline-size: 60cqi;
    block-size: 60cqi;
  }

  .orb--small {
    inset-block-end: -26cqi;
    inset-inline-start: 22cqi;
    inline-size: 44cqi;
    block-size: 44cqi;
    background: color-mix(in oklch, var(--tx-deck-accent) 10%, transparent);
  }

  .hero {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: clamp(16px, 2.2cqi, 32px);
    max-inline-size: 88%;
    min-block-size: 0;
  }

  .subtitle {
    max-inline-size: 38ch;
  }

  .meta {
    position: relative;
  }
</style>
