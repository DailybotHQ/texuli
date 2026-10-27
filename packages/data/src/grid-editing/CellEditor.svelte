<script lang="ts" generics="T">
import { tick } from 'svelte';
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

/**
 * The boolean editor spans two focusable controls (switch and Save). It
 * commits only when focus leaves the pair, so Tab from the switch to Save
 * keeps the editor open.
 */
function onBoolFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget;
  const wrapper = event.currentTarget as HTMLElement;
  if (next instanceof Node && wrapper.contains(next)) return;
  onSave();
}

/** Save commits and returns focus to the cell, never dropping it to <body>. */
function onSaveClick(event: MouseEvent): void {
  const gridcell = (event.currentTarget as HTMLElement).closest<HTMLElement>('[role=gridcell]');
  onSave();
  void tick().then(() => gridcell?.focus());
}
</script>

{#if column.type === 'boolean'}
  <!--
    A span, not a label: the switch is named by aria-label, and a label
    ancestor would give the save button the switch's accessible name.
  -->
  <span class="tx-grid-edit__bool" onfocusout={onBoolFocusOut}>
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
    />
    <button type="button" class="tx-grid-edit__save" data-tx-grid-widget onclick={onSaveClick}>
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
