<script lang="ts">
/** `big-stat`: one number that lands the point, with its label, context and source. */
import { fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'big-stat'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
</script>

<LayoutFrame layout="big-stat" root={steps.at([])}>
  <div class="decor" aria-hidden="true" data-tx-deck-decor>
    <span class="ring"></span>
  </div>
  <div class="stat" data-slot="stat">
    <p class="tx-deck-layout__stat" data-slot="number" data-clamp="1" {@attach fitText(96)}>
      {p.number}
    </p>
    <span class="tx-deck-layout__accent" aria-hidden="true"></span>
    <p class="tx-deck-layout__lead label" data-slot="label" data-clamp="2">{p.label}</p>
    {#if p.context}
      <p class="tx-deck-layout__text" data-slot="context" data-clamp="2">{p.context}</p>
    {/if}
  </div>
  {#if p.source}
    <p class="tx-deck-layout__caption" data-slot="source">{p.source}</p>
  {/if}
</LayoutFrame>

<style>
  .decor {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .ring {
    position: absolute;
    inset-block-start: 50%;
    inset-inline-end: 6cqi;
    inline-size: 38cqi;
    block-size: 38cqi;
    translate: 0 -50%;
    border: 1.6cqi solid color-mix(in oklch, var(--tx-deck-accent) 14%, transparent);
    border-radius: 50%;
  }

  .stat {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: clamp(14px, 1.8cqi, 24px);
    max-inline-size: 82%;
    min-block-size: 0;
  }

  .label {
    max-inline-size: 30ch;
    font-weight: 600;
    font-family: var(--tx-font-heading, inherit);
  }
</style>
