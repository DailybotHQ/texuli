<script lang="ts">
import { fromMarkdown } from '@texuli/core/editor-markdown';
import { RichTextEditor } from '@texuli/editor/editor';

const { doc } = fromMarkdown(
  [
    '## Launch checklist',
    'The **beta** opens on Monday for the *Northwind* pilot team.',
    '- [x] Invite the pilot group',
    '- [ ] Share the [setup guide](https://example.com/guide)',
    '> Keep the first week small and listen closely.',
    '```text\nrelease: beta-2\n```',
  ].join('\n\n')
);
</script>

<section class="demo" aria-labelledby="editor-basic-title">
  <h2 id="editor-basic-title">Release notes</h2>
  <RichTextEditor value={doc} aria-labelledby="editor-basic-title" toolbar={false} />
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 40rem);
    color: var(--tx-foreground, CanvasText);
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
</style>
