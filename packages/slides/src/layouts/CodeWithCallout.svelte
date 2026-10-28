<script lang="ts">
/**
 * `code-with-callout`: a code block beside its explanation. The code paints
 * through the `blocks-code` family (tokenized, never as HTML), and its
 * `highlights` step one line range per step through the stage's step host.
 */
import BlockRenderer from '../stage/BlockRenderer.svelte';
import { fitContent, fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { layoutCodeBlock } from './media.ts';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'code-with-callout'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
let block = $derived(layoutCodeBlock(p.code));
let hostStep = $derived(steps.highlight(['code']) ?? 0);
</script>

<LayoutFrame layout="code-with-callout" root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <div class="split">
    <div class="code" data-slot="code" {...steps.at(['code'])} {@attach fitContent(0.6)}>
      {#if block}
        <BlockRenderer {block} mediaTrust={context.tier} {hostStep} t={context.t} />
      {:else}
        <p class="tx-deck-layout__refused" role="note">{context.t('layout.contentUnavailable')}</p>
      {/if}
    </div>
    <div class="callout" data-slot="callout" {@attach fitContent()}>
      {#if p.heading}
        <h3 class="tx-deck-layout__lead heading">{p.heading}</h3>
      {/if}
      <ul class="bullets">
        {#each p.bullets as bullet, index (index)}
          <li class="tx-deck-layout__text">{bullet}</li>
        {/each}
      </ul>
    </div>
  </div>
</LayoutFrame>

<style>
  .split {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
    gap: var(--tx-deck-layout-gap);
    min-block-size: 0;
  }

  .code,
  .callout {
    min-inline-size: 0;
    min-block-size: 0;
  }

  .code {
    display: grid;
    align-content: center;
  }

  .code :global(pre) {
    font-size: clamp(18px, 1.6cqi, 22px);
  }

  .callout {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: clamp(12px, 1.6cqi, 22px);
  }

  .heading {
    font-weight: 600;
    font-family: var(--tx-font-heading, inherit);
  }

  .bullets {
    display: grid;
    gap: clamp(10px, 1.2cqi, 16px);
    margin: 0;
    padding-inline-start: 1.1em;
  }

  .bullets li::marker {
    color: var(--tx-deck-accent);
  }

  @container (max-inline-size: 48rem) {
    .split {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
