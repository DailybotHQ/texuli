<script lang="ts">
/** `quote`: one short pull quote and its attribution. */
import { fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'quote'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
</script>

<LayoutFrame layout="quote" root={steps.at([])}>
  <span class="mark" aria-hidden="true" data-tx-deck-decor>“</span>
  <figure class="quote" data-slot="quote">
    <blockquote class="tx-deck-layout__quote" data-slot="pull-quote" data-clamp="5" {@attach fitText(36)}>
      {p.quote}
    </blockquote>
    {#if p.cite}
      <figcaption class="cite" data-slot="cite">
        <span class="tx-deck-layout__accent" aria-hidden="true"></span>
        <span class="tx-deck-layout__lead">{p.cite}</span>
      </figcaption>
    {/if}
  </figure>
</LayoutFrame>

<style>
  .mark {
    position: absolute;
    inset-block-start: 1cqi;
    inset-inline-start: 5cqi;
    color: color-mix(in oklch, var(--tx-deck-accent) 22%, transparent);
    font-family: var(--tx-font-heading, serif);
    font-size: clamp(160px, 24cqi, 320px);
    line-height: 1;
    user-select: none;
  }

  .quote {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: clamp(20px, 3cqi, 40px);
    min-block-size: 0;
    margin: 0;
    padding-inline: 4cqi;
  }

  blockquote {
    margin: 0;
  }

  .cite {
    display: flex;
    align-items: center;
    gap: clamp(12px, 1.6cqi, 24px);
  }
</style>
