<script lang="ts" generics="T">
import type { EditableColumn, EditorDraft } from './model.ts';
import './grid-editing.css';

/**
 * Inline editor for one cell, by column type. Native controls only (no overlay
 * layers inside a cell). Loaded lazily with the first edit.
 */
let {
  column,
  draft,
  onDraft,
  onKeydown,
  onSave,
}: {
  column: EditableColumn<T>;
  draft: EditorDraft;
  onDraft: (draft: EditorDraft) => void;
  onKeydown: (event: KeyboardEvent) => void;
  onSave: () => void;
} = $props();
</script>

{#if column.type === 'boolean'}
  <label class="tx-grid-edit__bool">
    <input
      data-tx-grid-editor
      data-tx-grid-widget
      type="checkbox"
      role="switch"
      aria-label={column.header}
      checked={draft === true}
      onchange={(event) => onDraft((event.currentTarget as HTMLInputElement).checked)}
      onkeydown={onKeydown}
    />
    <button type="button" class="tx-grid-edit__save" data-tx-grid-widget onclick={onSave}>
      Save
    </button>
  </label>
{:else if column.type === 'enum' && column.options}
  <select
    data-tx-grid-editor
    data-tx-grid-widget
    class="tx-grid-edit__control"
    aria-label={column.header}
    value={String(draft)}
    onchange={(event) => onDraft((event.currentTarget as HTMLSelectElement).value)}
    onkeydown={onKeydown}
  >
    {#each column.options as option (option)}
      <option value={option}>{option}</option>
    {/each}
  </select>
{:else}
  <!--
    Always type=text so invalid drafts (for number validation) can be typed.
    inputmode hints the soft keyboard; parseEditorValue still enforces the type.
  -->
  <input
    data-tx-grid-editor
    data-tx-grid-widget
    class="tx-grid-edit__control"
    aria-label={column.header}
    type="text"
    inputmode={column.type === 'number' ? 'decimal' : column.type === 'date' ? 'none' : 'text'}
    value={String(draft)}
    oninput={(event) => onDraft((event.currentTarget as HTMLInputElement).value)}
    onkeydown={onKeydown}
    onblur={onSave}
  />
{/if}
