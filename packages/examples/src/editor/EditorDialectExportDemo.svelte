<script lang="ts">
import { fromMarkdown } from '@texuli/core/editor-markdown';
import { EditorController } from '@texuli/editor/controller';
import { RichTextEditor } from '@texuli/editor/editor';
import { DialectExport } from '@texuli/editor/export';

const controller = new EditorController({
  doc: fromMarkdown(
    '# Standup\n\n**Done:** shipped the [beta](https://example.com/beta) to `staging`.\n\n- [x] Fix the login bug\n- [ ] Review the ~~old~~ new copy\n\n> Blocked on design review. @here please take a look.'
  ).doc,
});
</script>

<section class="demo" aria-labelledby="editor-export-title">
  <h2 id="editor-export-title">Standup note</h2>
  <RichTextEditor {controller} aria-labelledby="editor-export-title" />
  <DialectExport {controller} dialect="slack" />
</section>

<style>
  .demo {
    display: grid;
    gap: var(--tx-space-3);
    inline-size: min(100%, 44rem);
    color: var(--tx-foreground, CanvasText);
  }

  h2 {
    margin: 0;
  }
</style>
