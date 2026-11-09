/**
 * Copy for the Documents "How it works" section. Six steps follow a document from blocks
 * to output: author → edit with operations → rich text → edit and read → export → sync
 * (optional). Each step names the registry package that does it. `DOCUMENTS_HOW_TRACE`
 * records, per step, the subpath export and the registry capability it rests on, so the
 * test checks every claim against `entries/documents.ts` and the package manifests.
 *
 * Facts come from the document, editor and pages READMEs: typed blocks with persisted
 * ids and an untrusted loader, typed operations with exact inverses in one op log, the
 * editor's toolbar, link dialog, safe paste and Markdown, the page editor's slash menu
 * and keyboard block drag, the read-only reader, Markdown import and export, the owned
 * DOCX and PDF writers, `exportDocument` in pages, and the CRDT sync core. Paged-view
 * editing is planned and not claimed. No counts are stated. The last step also carries the
 * collaboration story (comments, suggestions and version history in the pages README).
 * The art band is the reserved `solution-documents-how` slot.
 */
import type { SolutionHowProps } from '../../shared/types.ts';

export const DOCUMENTS_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From blocks to a finished document.',
  art: { slot: 'solution-documents-how', variant: 'band' },
  steps: [
    {
      title: 'Author',
      body: 'Compose typed blocks with persisted ids, or load a document from an agent or a file through the untrusted loader.',
      package: '@texuli/document',
    },
    {
      title: 'Edit with operations',
      body: 'Every change is a typed operation with an exact inverse in one op log, so undo and redo share one history.',
      package: '@texuli/document',
    },
    {
      title: 'Write rich text',
      body: 'A formatting toolbar, a link dialog, safe paste, and Markdown in and out.',
      package: '@texuli/editor',
    },
    {
      title: 'Edit and read',
      body: 'The page editor adds a slash menu and block drag with keyboard equivalents; the reader shows the result read-only, with an outline.',
      package: '@texuli/pages',
    },
    {
      title: 'Export',
      body: 'Markdown, DOCX and PDF from writers Texuli owns; the pages export entry hands the file to the browser.',
      package: '@texuli/document',
    },
    {
      title: 'Sync, if you need it',
      body: 'The CRDT sync core merges edits from several replicas; the collaborative editor adds comments, suggestions and version history. Your app supplies the transport.',
      package: '@texuli/document',
    },
  ],
};

/** Per step (same order): the subpath export it uses and the capability it demonstrates. */
export const DOCUMENTS_HOW_TRACE: readonly Readonly<{ subpath: string; capability: string }>[] = [
  { subpath: './model', capability: 'edit' },
  { subpath: './ops', capability: 'edit' },
  { subpath: './editor', capability: 'edit' },
  { subpath: './reader', capability: 'read' },
  { subpath: './docx', capability: 'export' },
  { subpath: './sync', capability: 'collaborate' },
];
