import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const DOCUMENTS_QUICKSTART_VERIFIED_BY =
  'apps/website/tests/solutions/documents-quickstart.test.ts';

export const DOCUMENTS_INSTALL =
  'pnpm add @texuli/document @texuli/pages @texuli/editor @texuli/tokens';

/** JSON passed to `loadUntrustedDocument` from `@texuli/document/schema`. */
export const DOCUMENTS_JSON = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Release notes', locale: 'en' },
  blocks: [
    {
      id: 'p1',
      type: 'paragraph',
      content: [{ type: 'text', text: 'Shipped the new editor.', marks: [] }],
    },
  ],
} as const;

export const DOCUMENTS_CREATE_SAMPLE = `import { createDocument, paragraphBlock } from '@texuli/document/model';
import { applyOperations } from '@texuli/document/ops';
import { documentToMarkdown } from '@texuli/document/markdown';

const doc = createDocument({
  meta: { title: 'Release notes' },
  blocks: [paragraphBlock('p1', 'Shipped the new editor.')],
});

const edit = applyOperations(doc, [
  { op: 'insert-text', id: 'p1', offset: 0, text: 'Today: ' },
]);

if (edit.ok) {
  console.log(documentToMarkdown(edit.document));
}
`;

export const DOCUMENTS_LOAD_SAMPLE = `import { loadUntrustedDocument } from '@texuli/document/schema';

const result = loadUntrustedDocument(${JSON.stringify(DOCUMENTS_JSON, null, 2)});

if (result.ok) {
  console.log(result.document.blocks.length);
}
`;

export const DOCUMENTS_EDITOR_SAMPLE = `<script lang="ts">
  import { createDocument, paragraphBlock } from '@texuli/document/model';
  import { PageEditor } from '@texuli/pages/editor';
  import '@texuli/tokens/base.css';

  let doc = $state.raw(
    createDocument({
      meta: { title: 'Release notes' },
      blocks: [paragraphBlock('p1', 'Shipped the new editor.')],
    }),
  );
</script>

<PageEditor document={doc} onChange={(next) => (doc = next)} />
`;

export function documentsQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Start with a document',
    install: { label: 'Install', language: 'bash', code: DOCUMENTS_INSTALL },
    samples: [
      { label: 'Create and edit', language: 'ts', code: DOCUMENTS_CREATE_SAMPLE },
      { label: 'Load untrusted JSON', language: 'ts', code: DOCUMENTS_LOAD_SAMPLE },
      { label: 'Edit with PageEditor', language: 'svelte', code: DOCUMENTS_EDITOR_SAMPLE },
    ],
    verifiedBy: DOCUMENTS_QUICKSTART_VERIFIED_BY,
  };
}
