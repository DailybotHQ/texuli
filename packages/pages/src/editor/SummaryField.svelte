<script lang="ts">
// A toggle's summary: a one-line `@texuli/editor` surface whose text is the
// toggle's `summary` (edited with `replace-text` on the toggle). Enter opens
// the toggle and moves into its first block.
import { getAnnouncer } from '@texuli/core/announcer';
import type { EditorDocument } from '@texuli/core/editor-model';
import type { DocumentInline, ToggleBlock } from '@texuli/document/model';
import { equalData } from '@texuli/document/ops-core';
import { EditorSurface } from '@texuli/editor/editor';
import { untrack } from 'svelte';
import { getPagesContext } from './context.ts';
import { RowController } from './row-controller.ts';
import { inlineLength } from './text.ts';

let { block, label }: { block: ToggleBlock; label: string } = $props();
const context = getPagesContext();
const editor = context.editor;

const toDoc = (toggle: ToggleBlock): EditorDocument => ({
  version: 1,
  blocks: [{ id: toggle.id, type: 'paragraph', content: toggle.summary }],
});
const contentOf = (doc: EditorDocument): DocumentInline[] => {
  const first = doc.blocks[0];
  return first && first.type === 'paragraph' ? ([...first.content] as DocumentInline[]) : [];
};

let synced: ToggleBlock = untrack(() => block);

const controller = new RowController(
  {
    doc: untrack(() => toDoc(block)),
    newId: () => editor.newId(),
    announce: (message) => {
      if (editor.options.announce) editor.options.announce(message);
      else if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
    },
    onChange: (doc) => {
      const content = contentOf(doc);
      if (equalData(content, block.summary)) return;
      const result = editor.apply(
        [
          {
            op: 'replace-text',
            id: block.id,
            from: 0,
            to: inlineLength(block.summary),
            content,
          },
        ],
        { group: `summary:${block.id}` }
      );
      const located = editor.locate(block.id);
      if (result.ok && located) synced = located.node as ToggleBlock;
      else controller.replace(toDoc(block));
    },
  },
  {
    undo: () => editor.undo(),
    redo: () => editor.redo(),
    enter: () => {
      if (block.open === false) editor.setAttrs(block.id, { open: true });
      const first = block.blocks[0];
      if (first) editor.requestFocus(first.id, { edge: 'start' });
      return true;
    },
  }
);

$effect(() => {
  const current = block;
  untrack(() => {
    if (current === synced) return;
    synced = current;
    if (equalData(contentOf(controller.doc), current.summary)) return;
    controller.replace(toDoc(current));
  });
});
</script>

<div class="tx-pages-summary">
  <EditorSurface {controller} {label} readonly={context.readonly()} trust="untrusted" />
</div>
