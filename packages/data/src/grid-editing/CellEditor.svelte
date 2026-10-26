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
  saveLabel = 'Save',
  invalid = false,
  describedBy,
}: {
  column: EditableColumn<T>;
  draft: EditorDraft;
  onDraft: (draft: EditorDraft) => void;
  onKeydown: (event: KeyboardEvent) => void;
  onSave: () => void;
  /** Label of the boolean editor's confirm button. */
  saveLabel?: string;
  /** The draft failed validation: the control exposes `aria-invalid`. */
  invalid?: boolean;
  /** `id` of the element describing the current error, if any. */
  describedBy?: string;
} = $props();

const described = $derived({
  'aria-invalid': invalid ? ('true' as const) : undefined,
  'aria-describedby': describedBy,
});
</script>

{#if column.type === 'boolean'}
  <!--
    A span, not a label: the switch is named by aria-label, and a label
    ancestor would give the save button the switch's accessible name.
  -->
  <span class="tx-grid-edit__bool">
    <input
      data-tx-grid-editor
      data-tx-grid-widget
      type="checkbox"
      role="switch"
      aria-label={column.header}
      {...described}
      checked={draft === true}
      onchange={(event) => onDraft((event.currentTarget as HTMLInputElement).checked)}
      onkeydown={onKeydown}
      onblur={onSave}
    />
    <button type="button" class="tx-grid-edit__save" data-tx-grid-widget onclick={onSave}>
      {saveLabel}
    </button>
  </span>
{:else if column.type === 'enum' && column.options}
  <select
    data-tx-grid-editor
    data-tx-grid-widget
    class="tx-grid-edit__control"
    aria-label={column.header}
    {...described}
    value={String(draft)}
    onchange={(event) => onDraft((event.currentTarget as HTMLSelectElement).value)}
    onkeydown={onKeydown}
    onblur={onSave}
  >
    {#each column.options as option (option)}
      <option value={option}>{option}</option>
    {/each}
  </select>
{:else}
  <!--
    Always type=text so invalid drafts (for number validation) can be typed.
    inputmode hints the soft keyboard (never "none": the draft must stay
    typeable on touch screens); parseEditorValue still enforces the type.
  -->
  <input
    data-tx-grid-editor
    data-tx-grid-widget
    class="tx-grid-edit__control"
    aria-label={column.header}
    {...described}
    type="text"
    inputmode={column.type === 'number' ? 'decimal' : 'text'}
    value={String(draft)}
    oninput={(event) => onDraft((event.currentTarget as HTMLInputElement).value)}
    onkeydown={onKeydown}
    onblur={onSave}
  />
{/if}
