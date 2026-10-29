<script lang="ts">
/**
 * The `component` renderer: a whole slide painted by one catalog component.
 * The slide title (when set) heads it; the component fills the rest. Steps
 * on a component slide are its `steps` labels: the stage exposes the
 * current one on `data-tx-deck-step`, for components that follow it.
 */
import type { ComponentSlide as ComponentSlideData } from '@texuli/deck/model';
import { slideStateKey } from '../registry/state.ts';
import { getDeckStepContext } from '../stage/context.ts';
import type { DeckSlideRendererProps } from '../stage/renderers.ts';
import CatalogNode from './CatalogNode.svelte';

let { slide, context }: DeckSlideRendererProps<ComponentSlideData> = $props();
const fromContext = getDeckStepContext();
let step = $derived(fromContext ?? context.step);
</script>

{#if slide.title}
  <h2 class="tx-deck-stage__slide-title" data-tx-deck-morph-id="title">{slide.title}</h2>
{/if}
<div class="tx-deck-component-slide" data-tx-deck-step={step.step} data-tx-deck-step-label={step.label}>
  <CatalogNode
    id={slide.component.component}
    props={slide.component.props as Record<string, unknown>}
    {context}
    stateKey={slideStateKey(slide.id, [])}
    label={slide.title ?? slide.component.component}
    height="fill"
  />
</div>

<style>
  .tx-deck-component-slide {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-block-size: 0;
    inline-size: 100%;
  }
</style>
