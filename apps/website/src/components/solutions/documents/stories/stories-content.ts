/**
 * The Documents signature stories and the evidence behind every claim. Copy comes from the
 * `@texuli/document` and `@texuli/pages` READMEs and the Documents audit; each story names
 * capability ids from `entries/documents.ts`, and each claim cites a repository file that
 * contains the named marker (a README, a test or the demo fixture). The test checks that
 * every cited file exists and contains its marker. Paged-view editing is planned, so the
 * reading story names that capability and the shared block shows its planned chip.
 */
import type { SolutionStoriesProps } from '../../shared/types.ts';

export const DOCUMENTS_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'What a document can do',
  stories: [
    {
      id: 'edit',
      title: 'Every edit can be undone',
      body: 'Each change is a typed operation with an exact inverse, kept in one op log, so undo and redo always work. The editor adds a slash menu of every block type and block drag with keyboard equivalents.',
      capabilities: ['edit'],
    },
    {
      id: 'read',
      title: 'Read it, or see it on real pages',
      body: 'A read-only reader gives headings anchors and an outline. The paged view lays the same document out on real pages with headers and footers, and prints one sheet per page. Editing in the paged view is planned.',
      capabilities: ['read', 'paged-editing'],
      art: { slot: 'page-documents', variant: 'banner' },
    },
    {
      id: 'export',
      title: 'Markdown, DOCX and PDF from one source',
      body: 'Import and export Markdown, and write DOCX and PDF with writers Texuli owns, all from the same block document.',
      capabilities: ['export'],
    },
    {
      id: 'collaborate',
      title: 'Work on it together',
      body: 'A CRDT sync core merges edits from several replicas. The collaborative editor adds comments anchored to the text, suggestions to accept or reject, and version history with restore. Your app supplies the transport.',
      capabilities: ['collaborate'],
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
  collaborate: [
    {
      claim: 'A CRDT sync core',
      source: 'packages/document/README.md',
      marker: 'the CRDT sync core',
    },
    {
      claim: 'Comments anchored to the text',
      source: 'packages/pages/README.md',
      marker: 'comments anchored to the text',
    },
    {
      claim: 'Suggestions with accept and reject',
      source: 'packages/pages/README.md',
      marker: 'suggestions with accept and reject',
    },
    {
      claim: 'Version history with restore',
      source: 'packages/pages/README.md',
      marker: 'version history with restore',
    },
    {
      claim: 'Replicas converge',
      source: 'packages/document/tests/collab-convergence.test.ts',
      marker: 'converge',
    },
    {
      claim: 'The host app supplies the transport (no hosted service)',
      source: 'apps/website/src/data/solutions/entries/documents.ts',
      marker: 'Collaboration needs a transport from the host app',
    },
  ],
};
