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
    tier="untrusted"
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
  .slides-preview {
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  .preview__note {
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
</style>
