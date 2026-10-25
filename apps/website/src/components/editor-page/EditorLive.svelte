<script lang="ts">
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import type { EditorDocument } from '@texuli/core/editor-model';
import { RichTextEditor } from '@texuli/editor/editor';
import { EDITOR_DEMO_MARKDOWN, SITE_EDITOR_LABELS } from './editor.ts';

/**
 * The /editor-page/ live demo: the real `RichTextEditor` on a fictional
 * document loaded from Markdown at the untrusted tier, with the Markdown it
 * saves as shown beside it. Every value renders as text.
 */
const load = () => fromMarkdown(EDITOR_DEMO_MARKDOWN).doc;

let value: EditorDocument = $state.raw(load());
let saved: EditorDocument = $state.raw(value);
const markdown = $derived(toMarkdown(saved));

function reset() {
  value = load();
  saved = value;
}
</script>

<div class="editor-live" data-editor-live>
  <h3 id="editor-live-title">Launch notes</h3>
  <RichTextEditor
    {value}
    aria-labelledby="editor-live-title"
    labels={SITE_EDITOR_LABELS}
    placeholder="Write the notes…"
    onChange={(doc) => (saved = doc)}
  />
  <div class="editor-live__actions">
    <button type="button" class="editor-live__reset" onclick={reset}>Reset the document</button>
  </div>
  <h3 id="editor-live-markdown">Saved as Markdown</h3>
  <pre class="editor-live__markdown" aria-labelledby="editor-live-markdown" data-editor-markdown>{markdown}</pre>
</div>

<style>
  .editor-live {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 48rem);
    color: var(--tx-foreground, CanvasText);
  }
  h3 {
    margin: 0;
    font-size: 1.05rem;
  }
  .editor-live__actions {
    display: flex;
    justify-content: flex-end;
  }
  .editor-live__reset {
    font: inherit;
    font-size: 0.875rem;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    color: inherit;
    background: var(--tx-surface, Canvas);
    cursor: pointer;
  }
  .editor-live__reset:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .editor-live__markdown {
    margin: 0;
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-muted, color-mix(in oklab, CanvasText 6%, Canvas));
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.85rem;
    white-space: pre-wrap;
  }
</style>
