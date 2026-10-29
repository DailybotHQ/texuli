/**
 * Static copy for /documents-page/: the status, the pieces of the two
 * document packages, the sections and the docs they point to. Plain data,
 * so the page and its tests share one source (labels are text, never HTML).
 */

/** The release the document packages first ship in (on npm, in development, pre-1.0). */
export const DOCUMENTS_RELEASE = '0.7.0';

/** The status line every surface of this page repeats. */
export const DOCUMENTS_STATUS = `In development, on npm from ${DOCUMENTS_RELEASE}, a pre-1.0 release.`;

export interface DocumentsPiece {
  readonly name: string;
  readonly role: string;
}

/** The subpaths of the two packages, each one small piece. */
export const DOCUMENTS_PIECES: readonly DocumentsPiece[] = [
  { name: 'document/model', role: 'the block format, persisted ids' },
  { name: 'document/ops', role: 'operations, bounded patches, undo' },
  { name: 'document/sync', role: 'the owned CRDT, adapters' },
  { name: 'document/paged', role: 'pages, breaks, headers, footers' },
  { name: 'pages/editor', role: 'slash menu, drag, columns, embeds' },
  { name: 'pages/reader', role: 'read-only, outline, anchors' },
  { name: 'pages/export', role: 'Markdown, DOCX, PDF as a Blob' },
  { name: 'pages/collab', role: 'comments, suggestions, history' },
  { name: 'pages/host', role: 'agent documents in the player' },
];

export interface DocumentsSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export const DOCUMENTS_SECTIONS: readonly DocumentsSection[] = [
  {
    id: 'workbench',
    title: 'One document: edit, read, paginate, export',
    summary:
      'A live editor on a fictional team handbook. Type / in an empty paragraph for the block menu, drag a handle or press Alt+Up and Alt+Down to move a block, resize the columns, open the nested pages and watch the embedded chart paint. Switch the view to read it, or to lay it out on A4 pages with a header, a footer and page numbers. Export writes the same document as Markdown, DOCX or PDF, in your browser.',
  },
  {
    id: 'collab',
    title: 'Two editors, one document',
    summary:
      'Ada and Lin edit the same draft side by side. Their replicas sync through the in-memory adapter (the BroadcastChannel adapter does the same across tabs), so edits, comments, suggestions and versions converge. Comment on a selection, switch on Suggesting and accept or reject the change from the other side, save a version and restore it.',
  },
  {
    id: 'agents',
    title: 'Documents as agent data',
    summary:
      'An agent writes a document as one keyed document node of a blueprint (spec 0.7.0). The player validates it at the untrusted tier and paints it through the document host of @texuli/pages. To edit it, the agent sends a bounded patch addressed by the node key, never a rewrite; a patch that fails any check changes nothing.',
  },
  {
    id: 'keyboard',
    title: 'Keyboard',
    summary:
      'Everything on this page works without a pointer. The editor follows the WAI-ARIA Authoring Practices patterns for its combobox, listbox, window splitter and feed.',
  },
  {
    id: 'safety',
    title: 'What keeps it safe',
    summary:
      'Documents are data. Nothing on this page turns document text into markup, and every link and image passes the URL policy.',
  },
];

export interface DocumentsKey {
  readonly where: string;
  readonly keys: string;
  readonly effect: string;
}

/** A short keyboard table (the full one is in the editor docs). */
export const DOCUMENTS_KEYS: readonly DocumentsKey[] = [
  { where: 'Text', keys: '/ in an empty paragraph', effect: 'Open the block menu' },
  {
    where: 'Block menu',
    keys: 'Type, Up, Down, Enter, Escape',
    effect: 'Filter, move, insert, close',
  },
  { where: 'Text or handle', keys: 'Alt+Up, Alt+Down', effect: 'Move the block, announced' },
  { where: 'Text', keys: 'Escape', effect: 'Select the block (focus its handle)' },
  {
    where: 'Handle',
    keys: 'Space or Enter, arrows, Space or Enter',
    effect: 'Pick up, move, drop (Escape cancels)',
  },
  { where: 'Column separator', keys: 'Left, Right, Home, End', effect: 'Resize by one twelfth' },
  { where: 'Anywhere in the editor', keys: 'Mod+Z, Mod+Shift+Z', effect: 'Undo, redo' },
  {
    where: 'Collaborative text',
    keys: 'Control+Alt+M (Command+Option+M)',
    effect: 'Comment on the selection',
  },
  { where: 'Comment feed', keys: 'Page Down, Page Up', effect: 'Next or previous thread' },
];

/** The rules the packages keep by construction. */
export const DOCUMENTS_RULES: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Validated before it paints',
    body: 'Documents from a file, a link or an agent are validated at the untrusted tier first. A refused edit changes nothing and is announced.',
  },
  {
    title: 'One edit path',
    body: 'Typing, a slash insert, a move, a resize, an undo and a merged remote change are all operations in one op log, so history, persistence and sync agree.',
  },
  {
    title: 'No HTML sinks',
    body: 'Text renders as text. Links pass safeHref and images safeImageSrc at the untrusted tier; embeds are validated again by the player.',
  },
  {
    title: 'Exports never navigate',
    body: 'The writers escape by construction. A download opens only the blob: URL it created, and revokes it at once.',
  },
];

export interface DocumentsDoc {
  readonly label: string;
  readonly path: string;
}

/** Package docs in the repository (the site does not render them yet). */
export const DOCUMENTS_DOCS: readonly DocumentsDoc[] = [
  { label: '@texuli/document', path: 'packages/document/README.md' },
  { label: '@texuli/pages', path: 'packages/pages/README.md' },
  { label: 'Editor', path: 'packages/pages/docs/editor.md' },
  { label: 'Reader', path: 'packages/pages/docs/reader.md' },
  { label: 'Paged view and print', path: 'packages/pages/docs/paged.md' },
  { label: 'Export', path: 'packages/pages/docs/export.md' },
  { label: 'Collaboration', path: 'packages/pages/docs/collab.md' },
  { label: 'Document host', path: 'packages/pages/docs/host.md' },
  { label: 'Catalog patches', path: 'packages/catalog/docs/edit.md' },
];
