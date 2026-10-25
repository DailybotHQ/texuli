<script lang="ts">
import type { EditorDocument } from '@texuli/core/editor-model';
import { untrack } from 'svelte';
import { SITE_EDITOR_LABELS } from '../../../editor-page/editor.ts';
import { readRichText, writeRichText } from './richtext.ts';

/**
 * The editor loads as its own chunk when a text field first renders: the
 * builder document stays within its budget and the code arrives on demand.
 */
const editorModule = import('@texuli/editor/editor');

/**
 * One Markdown field of a text block, edited through the rich text editor.
 * The field still stores Markdown: the editor reads it (reporting what it
 * could not keep) and each edit writes the Markdown back through `onchange`.
 * A Markdown source toggle swaps in the plain textarea for exact text.
 */
let {
  id,
  labelId,
  value,
  max,
  invalid = false,
  describedBy,
  onchange,
}: {
  id: string;
  labelId: string;
  value: string;
  max: number;
  invalid?: boolean;
  describedBy?: string;
  onchange: (markdown: string) => void;
} = $props();

let source = $state(false);
/** The Markdown last exchanged with the host, so the editor's own edits never reload it. */
let exchanged = untrack(() => value);
const initial = untrack(() => readRichText(value, max));
// Held apart: the editor reloads whenever `doc` is reassigned, so only an outside value does that.
let doc = $state.raw(initial.doc);
let notes = $state.raw(initial.notes);

// A value from outside (builder undo, JSON commit, the source textarea) reloads the editor.
$effect(() => {
  if (value === exchanged) return;
  exchanged = value;
  const field = readRichText(
    value,
    untrack(() => max)
  );
  doc = field.doc;
  notes = field.notes;
});

function edited(next: EditorDocument) {
  const markdown = writeRichText(next);
  if (markdown === exchanged) return;
  exchanged = markdown;
  if (notes.length) notes = [];
  onchange(markdown);
}
</script>

<div class="markdown-field" data-markdown-field data-mode={source ? 'source' : 'rich'}>
  <button
    type="button"
    class="markdown-field__mode"
    aria-pressed={source}
    onclick={() => (source = !source)}
  >Markdown source</button>
  {#if source}
    <textarea
      {id}
      rows="4"
      maxlength={max}
      {value}
      aria-labelledby={labelId}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedBy}
      oninput={(event) => onchange(event.currentTarget.value)}
    ></textarea>
  {:else}
    {#await editorModule then editor}
      {@const Editor = editor.RichTextEditor}
      <Editor
        {id}
        value={doc}
        aria-labelledby={labelId}
        labels={{ ...SITE_EDITOR_LABELS, undo: 'Undo text', redo: 'Redo text' }}
        onChange={edited}
      />
    {/await}
    {#if notes.length}
      <ul class="markdown-field__notes" aria-label="Editor notes">
        {#each notes as note (note)}<li>{note}</li>{/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .markdown-field {
    display: grid;
    gap: 0.35rem;
  }
  .markdown-field__mode {
    justify-self: end;
    font: inherit;
    font-size: 0.8125rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
  .markdown-field__mode:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .markdown-field__mode[aria-pressed='true'] {
    background: var(--tx-accent, Highlight);
    color: var(--tx-accent-foreground, HighlightText);
  }
  .markdown-field textarea {
    box-sizing: border-box;
    inline-size: 100%;
    padding: 0.5rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.4rem;
    font: inherit;
    color: inherit;
    background: var(--tx-background, Canvas);
    resize: vertical;
  }
  .markdown-field textarea:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .markdown-field textarea[aria-invalid='true'] {
    border-color: var(--tx-destructive, Mark);
  }
  .markdown-field__notes {
    margin: 0;
    padding-inline-start: 1.1rem;
    font-size: 0.8125rem;
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
