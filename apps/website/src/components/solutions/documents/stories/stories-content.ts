/**
 * The Documents signature stories and the evidence behind every claim. Copy comes from the
 * `@texuli/document` and `@texuli/pages` READMEs and the Documents audit; each story names
 * capability ids from `entries/documents.ts`, and each claim cites a repository file that
 * contains the named marker (a README, a test or the demo fixture). The test checks that
 * every cited file exists and contains its marker. Paged-view editing is planned, so the
 * reading story names that capability and the shared block shows its planned chip.
 *
 * Three stories, in the order of their art (edit, read, export). With no `art` of their
 * own, each paints its reserved `solution-documents-story-<n>` slot
 * (`shared/art/art-slots.ts`). Collaboration is told by the last how-it-works step.
 */
import type { SolutionStoriesProps } from '../../shared/types.ts';

export const DOCUMENTS_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'One document. Every way to work with it.',
  stories: [
    {
      id: 'edit',
      title: 'Edit without fear: every change can be undone',
      body: 'Each change is a typed operation with an exact inverse, kept in one op log, so undo and redo always work. The editor adds a slash menu of every block type and block drag with keyboard equivalents.',
      capabilities: ['edit'],
    },
    {
      id: 'read',
      title: 'From the editor to the reader to the printed page',
      body: 'A read-only reader gives headings anchors and an outline. The paged view lays the same document out on real pages with headers and footers, and prints one sheet per page. Editing in the paged view is planned.',
      capabilities: ['read', 'paged-editing'],
    },
    {
      id: 'export',
      title: 'One source, three formats',
      body: 'Import and export Markdown, and write DOCX and PDF with writers Texuli owns. Every format comes from the same block document, so nothing is converted by hand.',
      capabilities: ['export'],
    },
  ],
};

export interface StoryClaim {
  /** The claim in plain words, as the story makes it. */
  readonly claim: string;
  /** A repository path, relative to the repository root. */
  readonly source: string;
  /** Text the source must contain (whitespace collapsed) for the claim to hold. */
  readonly marker: string;
}

export const DOCUMENTS_STORY_EVIDENCE: Readonly<Record<string, readonly StoryClaim[]>> = {
  edit: [
    {
      claim: 'Typed operations with exact inverses',
      source: 'packages/document/README.md',
      marker: 'typed operations with exact inverses',
    },
    {
      claim: 'One op log with undo',
      source: 'packages/document/README.md',
      marker: 'an op log with undo',
    },
    {
      claim: 'Undo and redo share one history',
      source: 'packages/pages/README.md',
      marker: 'undo, redo, persistence and sync share one history',
    },
    {
      claim: 'A slash menu of every block type',
      source: 'packages/pages/README.md',
      marker: 'a slash menu of every block type',
    },
    {
      claim: 'Block drag with keyboard equivalents',
      source: 'packages/pages/README.md',
      marker: 'keyboard equivalents',
    },
    {
      claim: 'Operations are tested',
      source: 'packages/document/tests/ops.test.ts',
      marker: 'inverse',
    },
  ],
  read: [
    {
      claim: 'A read-only reader with anchored headings and an outline',
      source: 'packages/pages/README.md',
      marker: 'the read-only reader with anchored headings and an outline',
    },
    {
      claim: 'Real pages with headers and footers',
      source: 'packages/pages/README.md',
      marker: 'headers and footers with page numbers',
    },
    {
      claim: 'Prints one sheet per page',
      source: 'packages/pages/README.md',
      marker: 'printed one sheet per page',
    },
    {
      claim: 'Editing in the paged view is planned',
      source: 'packages/pages/README.md',
      marker: 'editing in paged mode is planned',
    },
    {
      claim: 'The reader is tested',
      source: 'packages/pages/tests/reader.test.ts',
      marker: 'PageReader',
    },
  ],
  export: [
    {
      claim: 'Markdown import and export',
      source: 'packages/document/README.md',
      marker: 'Markdown import and export',
    },
    {
      claim: 'Owned DOCX and PDF writers',
      source: 'packages/document/README.md',
      marker: 'owned DOCX and PDF writers',
    },
    {
      claim: 'DOCX output is tested',
      source: 'packages/document/tests/docx.test.ts',
      marker: 'docx',
    },
    { claim: 'PDF output is tested', source: 'packages/document/tests/pdf.test.ts', marker: 'pdf' },
  ],
};
