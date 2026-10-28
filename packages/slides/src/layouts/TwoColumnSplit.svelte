<script lang="ts">
/** `two-column-split`: two parallel text columns under an optional title. */
import { fitContent, fitText } from './fit.ts';
import LayoutFrame from './LayoutFrame.svelte';
import { type LayoutRendererProps, useLayoutSteps } from './steps.ts';

let { slide, context }: LayoutRendererProps<'two-column-split'> = $props();
const steps = useLayoutSteps(() => context);
let p = $derived(slide.props);
let columns = $derived([
  { key: 'left' as const, value: p.left },
  { key: 'right' as const, value: p.right },
]);
</script>

<LayoutFrame layout="two-column-split" root={steps.at([])}>
  {#if p.title}
    <h2 class="tx-deck-layout__title" data-slot="title" data-clamp="2" {@attach fitText(40)}>
      {p.title}
    </h2>
  {/if}
  <div class="columns" data-slot="columns" {@attach fitContent()}>
    {#each columns as column (column.key)}
      <section class="tx-deck-layout__panel column" data-slot={column.key} {...steps.at([column.key])}>
        {#if column.value.heading}
          <h3 class="tx-deck-layout__lead heading">{column.value.heading}</h3>
        {/if}
        <p class="tx-deck-layout__text">{column.value.body}</p>
      </section>
    {/each}
  </div>
</LayoutFrame>

<style>
  .columns {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: center;
    gap: var(--tx-deck-layout-gap);
    min-block-size: 0;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 1.4cqi, 20px);
    border-block-start: clamp(4px, 0.5cqi, 8px) solid var(--tx-deck-accent);
  }

  .heading {
    font-weight: 600;
    font-family: var(--tx-font-heading, inherit);
  }

  @container (max-inline-size: 48rem) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
