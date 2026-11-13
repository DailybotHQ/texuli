<script lang="ts">
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import type { EditorDocument } from '@texuli/core/editor-model';
import { RichTextEditor } from '@texuli/editor/editor';

const initial = fromMarkdown(
  '## Release checklist\n\nConfirm the **launch date** with the team.\n\n- Update the changelog\n- Tag the build\n\n> Ship small, ship often.'
).doc;
let saved: EditorDocument = $state.raw(initial);
const markdown = $derived(toMarkdown(saved));
</script>

<section class="demo" aria-labelledby="editor-block-menu-title">
  <h2 id="editor-block-menu-title">Release notes</h2>
  <p class="hint">The text style menu sets paragraph, heading, list, quote or code in one undoable step.</p>
  <RichTextEditor
    value={initial}
    blockMenu
    aria-labelledby="editor-block-menu-title"
    onChange={(doc) => (saved = doc)}
  />
  <h3 id="editor-block-menu-markdown">Saved as Markdown</h3>
  <pre class="markdown" aria-labelledby="editor-block-menu-markdown">{markdown}</pre>
</section>

<style>
  .demo {
    display: grid;
    gap: var(--tx-space-3);
    inline-size: min(100%, 44rem);
    color: var(--tx-foreground, CanvasText);
  }

  h2,
  h3,
  .hint {
    margin: 0;
  }

  h3,
  .hint {
    color: var(--tx-muted-foreground, GrayText);
  }

  .markdown {
    margin: 0;
    padding: var(--tx-space-3);
    border-radius: var(--tx-shape-radius-lg);
    background: var(--tx-muted, color-mix(in oklab, CanvasText 6%, Canvas));
    font-family: var(--tx-font-mono, ui-monospace, monospace);
    white-space: pre-wrap;
  }
</style>
