<script lang="ts">
/** Static server-rendered view of the same primary fixture used by the island. */
import '@texuli/slides/styles.css';
import { layoutRenderers } from '@texuli/slides/layouts';
import { DeckStageCore, loadDeckLibraryTheme, validateDeckBlock } from '@texuli/slides/stage-core';
import { getSlidesDemoFixture } from './model.ts';

const deck = getSlidesDemoFixture('texuli-in-motion');
const renderers = { ...layoutRenderers, validateBlock: validateDeckBlock };
</script>

{#snippet previewChrome()}
  <span class="preview__note">Static slide preview</span>
{/snippet}

<div class="slides-preview" data-tx-slides-demo-preview="texuli-in-motion">
  <DeckStageCore
    {deck}
    syncHash={false}
    fit="container"
    tier="developer"
    defaultRenderers={false}
    {renderers}
    loadTheme={loadDeckLibraryTheme}
    autofocus={false}
    clickToAdvance={false}
    coverHeadingLevel={2}
    namespace="slides-solution-preview"
    chrome={previewChrome}
  />
</div>

<style>
  /*
   * The preview is server-rendered and never hydrates, so the stage never measures its box:
   * its viewport stays `data-tx-deck-fit="pending"`, which hides the canvas until a fit. Fit
   * it in CSS instead. The viewport is 16:9 at the preview's full width, like the canvas, so
   * the scale is the container width over the canvas width; `tan(atan2(a, b))` divides two
   * lengths into a plain number (trigonometric functions and container units).
   */
  .slides-preview {
    min-inline-size: 0;
    max-inline-size: 100%;
    container-type: inline-size;
  }

  .slides-preview :global(.tx-deck-stage__viewport[data-tx-deck-fit='pending'] .tx-deck-stage__canvas) {
    --tx-deck-scale: tan(atan2(100cqi, var(--tx-deck-canvas-width, 1280px)));
    visibility: visible;
  }

  .preview__note {
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
</style>
