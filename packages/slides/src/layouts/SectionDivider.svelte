<script lang="ts">
/** `section-divider`: a chapter break, an optional eyebrow and a large title. */
import { fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'section-divider'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
</script>

<LayoutFrame layout="section-divider" root={steps.at([])}>
  <span class="rule" aria-hidden="true" data-tx-deck-decor></span>
  <div class="section" data-slot="section">
    {#if p.eyebrow}
      <p class="tx-deck-layout__label" data-slot="eyebrow">{p.eyebrow}</p>
    {/if}
    <h2 class="tx-deck-layout__display" data-slot="title" data-clamp="3" {@attach fitText(56)}>
      {p.title}
    </h2>
    <span class="tx-deck-layout__accent" aria-hidden="true"></span>
  </div>
</LayoutFrame>

<style>
  .rule {
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    inline-size: clamp(12px, 1.4cqi, 20px);
    background: var(--tx-deck-accent);
  }

  .section {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: clamp(16px, 2cqi, 28px);
    max-inline-size: 90%;
    min-block-size: 0;
  }
</style>
