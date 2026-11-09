<script lang="ts">
import type { AddableBlock, DocumentsDemoAction, DocumentsDemoState } from '../model.ts';
import { ADDABLE_BLOCKS } from '../model.ts';

type Props = {
  demoState: DocumentsDemoState;
  sourceVisible: boolean;
  announcement: string;
  onAction: (action: DocumentsDemoAction) => void;
  onSource: () => void;
};

let { demoState, sourceVisible, announcement, onAction, onSource }: Props = $props();
let title = $state('');
let block = $state<AddableBlock>('paragraph');

$effect(() => {
  title = demoState.document.meta.title;
});

function changeBlock(event: Event): void {
  block = (event.currentTarget as HTMLSelectElement).value as AddableBlock;
}
</script>

<div class="documents-controls" role="group" aria-label="Document example controls">
  {#if demoState.mode === 'edit'}
    <form
      class="documents-controls__rename"
      aria-label="Rename document title"
      onsubmit={(event) => {
        event.preventDefault();
        onAction({ type: 'rename-title', title });
      }}
    >
      <label for="documents-demo-title">Document title</label>
      <input id="documents-demo-title" bind:value={title} maxlength="120" />
      <button type="submit">Update title</button>
    </form>

    <label class="documents-controls__add">
      <span>Add a block</span>
      <select value={block} onchange={changeBlock}>
        {#each ADDABLE_BLOCKS as kind (kind)}
          <option value={kind}>{kind}</option>
        {/each}
      </select>
    </label>
    <button type="button" onclick={() => onAction({ type: 'add-block', block })}>Add block</button>
  {/if}

  <button
    type="button"
    aria-pressed={demoState.mode === 'read'}
    onclick={() => onAction({ type: 'toggle-mode' })}
  >
    {demoState.mode === 'edit' ? 'Read view' : 'Edit view'}
  </button>
  <button type="button" onclick={() => onAction({ type: 'undo' })} disabled={!demoState.canUndo}>
    Undo demo change
  </button>
  <button type="button" onclick={() => onAction({ type: 'redo' })} disabled={!demoState.canRedo}>
    Redo demo change
  </button>
  <button
    type="button"
    aria-expanded={sourceVisible}
    aria-controls="documents-demo-source"
    onclick={onSource}
  >
    {sourceVisible ? 'Hide source' : 'View source'}
  </button>
  <button type="button" onclick={() => onAction({ type: 'reset' })}>Reset example</button>
</div>

<p class="documents-controls__status" role="status" aria-live="polite" aria-atomic="true">
  {announcement}
</p>

<style>
  .documents-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.65rem;
  }

  .documents-controls__rename,
  .documents-controls__add {
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
  }

  .documents-controls input,
  .documents-controls select,
  .documents-controls button {
    min-block-size: 2.75rem;
    max-inline-size: 100%;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--tx-border, GrayText);
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    font: inherit;
  }

  .documents-controls button {
    cursor: pointer;
    touch-action: manipulation;
  }

  .documents-controls button:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .documents-controls input:focus-visible,
  .documents-controls select:focus-visible,
  .documents-controls button:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .documents-controls__status {
    min-block-size: 1.5em;
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }

  @media (forced-colors: active) {
    .documents-controls input,
    .documents-controls select,
    .documents-controls button {
      border-color: ButtonText;
    }
  }
</style>
