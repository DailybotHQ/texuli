<script lang="ts">
/**
 * `closing-cta`: the last slide with one primary action. The action paints
 * as a `cta` content block (the Texuli button link of the structure family),
 * whose schema holds the href to `safeHref` at the untrusted tier; a refused
 * href renders the label as plain text, never a dead or unsafe link.
 */
import BlockRenderer from '../stage/BlockRenderer.svelte';
import { fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { layoutCtaBlock } from './media.ts';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'closing-cta'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
let block = $derived(layoutCtaBlock(p.cta));
</script>

<LayoutFrame layout="closing-cta" root={steps.at([])}>
  <div class="closing" data-slot="closing">
    <h2 class="tx-deck-layout__display" data-slot="title" data-clamp="3" {@attach fitText(48)}>
      {p.title}
    </h2>
    {#if p.text}
      <p class="tx-deck-layout__lead" data-slot="text" data-clamp="3">{p.text}</p>
    {/if}
    <div class="action" data-slot="cta" {...steps.at(['cta'])}>
      {#if block}
        <BlockRenderer {block} mediaTrust={context.tier} t={context.t} />
      {:else}
        <span class="cta" data-refused="href">{p.cta.label}</span>
      {/if}
    </div>
  </div>
  {#if p.footnote}
    <p class="tx-deck-layout__caption" data-slot="footnote">{p.footnote}</p>
  {/if}
</LayoutFrame>

<style>
  .closing {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: clamp(18px, 2.4cqi, 32px);
    max-inline-size: 86%;
    min-block-size: 0;
  }

  .cta {
    display: inline-flex;
    align-items: center;
    min-block-size: 64px;
    padding-inline: clamp(24px, 3cqi, 44px);
    border: 3px solid currentColor;
    border-radius: 999px;
    color: inherit;
    font-size: var(--tx-deck-type-lead);
    font-weight: 700;
    text-decoration: none;
  }

  /* The block's button link at slide scale. */
  .action :global(a) {
    min-block-size: 64px;
    padding-inline: clamp(24px, 3cqi, 44px);
    font-size: var(--tx-deck-type-lead);
  }

  .cta[data-refused] {
    border-style: dashed;
  }
</style>
