import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const EDITOR_QUICKSTART_VERIFIED_BY = 'tests/e2e/site-solution-editor.spec.ts';

export const EDITOR_BASIC_SAMPLE = `<script lang="ts">
import { RichTextEditor } from '@texuli/editor/editor';
import { documentToMarkdown, markdownToDocument } from '@texuli/editor/markdown';

// Untrusted by default: raw HTML stays text, every link passes the URL policy.
const { doc } = markdownToDocument('# Release notes\\n\\n- [x] Saved views');
let markdown = $state(documentToMarkdown(doc));
</script>

<RichTextEditor value={doc} label="Release notes" onChange={(next) => (markdown = documentToMarkdown(next))} />`;

export const EDITOR_EXTRAS_SAMPLE = `<script lang="ts">
import { getEmoji } from '@texuli/emojis/catalog';
import { EditorController } from '@texuli/editor/controller';
import { RichTextEditor } from '@texuli/editor/editor';
import { DialectExport } from '@texuli/editor/export';

const controller = new EditorController({
  shortcodes: (name) => getEmoji(\`:\${name}:\`)?.unicode,
});
</script>

<RichTextEditor {controller} blockMenu emoji label="Note" />
<DialectExport {controller} dialect="slack" />`;

export function editorQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Start with the editor',
    install: { label: 'Install', language: 'bash', code: 'pnpm add @texuli/editor@0.17.4' },
    samples: [
      { label: 'Markdown in and out', language: 'svelte', code: EDITOR_BASIC_SAMPLE },
      {
        label: 'Block menu, emoji and chat export (in development, not in a published release yet)',
        language: 'svelte',
        code: EDITOR_EXTRAS_SAMPLE,
      },
    ],
    verifiedBy: EDITOR_QUICKSTART_VERIFIED_BY,
  };
}
