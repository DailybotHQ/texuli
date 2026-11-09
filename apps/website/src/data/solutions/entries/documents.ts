import type { SolutionEntry } from '../schema.ts';

/** Documents: the document engine plus Pages as its user-facing layer (facts F-23, F-24). */
export const documents: SolutionEntry = {
  slug: 'documents',
  name: 'Documents',
  status: 'in development',
  tagline: 'Edit, read, paginate and export block documents.',
  summary:
    'A block document model with operations and undo, Markdown, pagination, DOCX and PDF writers and CRDT sync, with Pages composing the editor, reader and exports on top.',
  route: '/solutions/documents/',
  docs: '/guides/solutions/documents/',
  replaces: '/documents-page/',
  packages: [
    {
      name: '@texuli/document',
      subpaths: ['./model', './ops', './markdown', './paged', './docx', './pdf', './sync'],
      role: 'Document model, operations, Markdown, pagination, DOCX and PDF writers, sync',
    },
    {
      name: '@texuli/pages',
      subpaths: ['./editor', './reader', './export', './collab'],
      role: 'Editor, reader, exports and collaboration surfaces',
    },
    {
      name: '@texuli/editor',
      subpaths: ['./editor', './markdown'],
      role: 'Rich text surface inside the document editor',
    },
  ],
  capabilities: [
    {
      id: 'edit',
      title: 'Edit',
      summary: 'Edit block documents with operations and undo.',
      status: 'in development',
    },
    {
      id: 'read',
      title: 'Read',
      summary: 'Render a document in a reader view.',
      status: 'in development',
    },
    {
      id: 'export',
      title: 'Export',
      summary: 'Write Markdown, DOCX and PDF from the same document.',
      status: 'in development',
    },
    {
      id: 'collaborate',
      title: 'Collaborate',
      summary: 'Merge edits from several replicas through CRDT sync.',
      status: 'in development',
    },
    {
      id: 'paged-editing',
      title: 'Paged-view editing',
      summary: 'Edit directly in the paginated view.',
      status: 'planned',
    },
  ],
  platforms: [
    { platform: 'web', status: 'in development', evidence: [] },
    { platform: 'compose-desktop', status: 'planned', evidence: [] },
    { platform: 'android', status: 'planned', evidence: [] },
    { platform: 'ios', status: 'planned', evidence: [] },
  ],
  demo: {
    id: 'documents',
    title: 'Edit a report',
    scenarios: ['product-report'],
    limits: ['Runs in the browser on one fixture document; nothing is saved.'],
  },
  art: { hero: { slot: 'solution-documents-hero', variant: 'plate' } },
  limits: [
    'Pre-1.0 and in development: a new minor version may break the API.',
    'Paged-view editing is planned; the paged view is read-only today.',
    'Sheet and canvas embeds are references, not painted embeds.',
    'Collaboration needs a transport from the host app; there is no hosted service.',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/documents/' },
    { label: 'Current demo page', href: '/documents-page/' },
    { label: '@texuli/pages on npm', href: 'https://www.npmjs.com/package/@texuli/pages' },
  ],
};
