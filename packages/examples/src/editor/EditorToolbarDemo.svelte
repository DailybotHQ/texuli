<script lang="ts">
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import type { EditorDocument } from '@texuli/core/editor-model';
import { RichTextEditor } from '@texuli/editor/editor';

const initial = fromMarkdown(
  'Draft the **weekly update** for the design team.\n\n- Summarize the *review*\n- Link the [notes](https://example.com/notes)'
).doc;
let saved: EditorDocument = $state.raw(initial);
const markdown = $derived(toMarkdown(saved));
</script>

<section class="demo" aria-labelledby="editor-toolbar-title">
  <h2 id="editor-toolbar-title">Weekly update</h2>
  <RichTextEditor
    value={initial}
    aria-labelledby="editor-toolbar-title"
    placeholder="Write the update…"
    onChange={(doc) => (saved = doc)}
  />
  <h3 id="editor-toolbar-markdown">Saved as Markdown</h3>
  <pre class="markdown" aria-labelledby="editor-toolbar-markdown">{markdown}</pre>

  <div class="narrow-rtl" dir="rtl" lang="ar" aria-label="Toolbar at a narrow RTL width">
    <h3 id="editor-toolbar-rtl-title">محرر بعرض ضيق واتجاه RTL</h3>
    <RichTextEditor value={initial} aria-labelledby="editor-toolbar-rtl-title" />
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 44rem);
    color: var(--tx-foreground, CanvasText);
  }

  h2,
  h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  h3 {
    font-size: 0.95rem;
    color: var(--tx-muted-foreground, GrayText);
  }

  .markdown {
    margin: 0;
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-muted, color-mix(in oklab, CanvasText 6%, Canvas));
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    font-size: 0.85rem;
    white-space: pre-wrap;
  }

  .narrow-rtl {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 360px);
    padding: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
  }
</style>
