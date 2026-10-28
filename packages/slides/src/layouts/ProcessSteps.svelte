<script lang="ts">
/** `process-steps`: a 3–5 step linear process, numbered and connected. */
import { fitContent, fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'process-steps'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
</script>

<LayoutFrame layout="process-steps" root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <ol class="steps" data-slot="steps" data-count={p.steps.length} {@attach fitContent()}>
    {#each p.steps as item, index (index)}
      <li class="step" data-slot="step" {...steps.at(['steps', index])}>
        {#if index < p.steps.length - 1}
          <span class="connector" aria-hidden="true" data-tx-deck-decor></span>
        {/if}
        <span class="number" aria-hidden="true">{index + 1}</span>
        <div class="copy">
          <h3 class="tx-deck-layout__lead heading">{item.title}</h3>
          {#if item.body}
            <p class="tx-deck-layout__text">{item.body}</p>
          {/if}
        </div>
      </li>
    {/each}
  </ol>
</LayoutFrame>

<style>
  .steps {
    display: grid;
    flex: 1;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    align-content: center;
    gap: clamp(16px, 2.4cqi, 32px);
    min-block-size: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .step {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 1.4cqi, 20px);
    min-inline-size: 0;
  }

  .connector {
    position: absolute;
    inset-block-start: calc(clamp(56px, 6cqi, 80px) / 2);
    inset-inline-start: clamp(56px, 6cqi, 80px);
    inline-size: calc(100% - clamp(56px, 6cqi, 80px) + clamp(16px, 2.4cqi, 32px));
    block-size: clamp(3px, 0.35cqi, 5px);
    border-radius: 999px;
    background: color-mix(in oklch, var(--tx-deck-accent) 40%, transparent);
  }

  .number {
    position: relative;
    display: grid;
    place-items: center;
    flex: none;
    inline-size: clamp(56px, 6cqi, 80px);
    block-size: clamp(56px, 6cqi, 80px);
    border: clamp(3px, 0.4cqi, 6px) solid var(--tx-deck-accent);
    border-radius: 50%;
    font-family: var(--tx-font-heading, inherit);
    font-size: clamp(24px, 2.6cqi, 34px);
    font-weight: 700;
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 0.8cqi, 12px);
  }

  .heading {
    font-weight: 600;
    font-family: var(--tx-font-heading, inherit);
  }

  @container (max-inline-size: 48rem) {
    .steps {
      grid-auto-flow: row;
    }

    .step {
      flex-direction: row;
      align-items: flex-start;
    }

    .connector {
      display: none;
    }
  }
</style>
