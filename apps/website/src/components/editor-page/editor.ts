/**
 * Data for the /editor-page/ area: the live demo's fictional document, the
 * documented vocabularies and where the package docs live. Framework-free so
 * the page, the island and the tests share one source.
 */

/**
 * Toolbar names on the site carry the visible glyph text (label in name,
 * WCAG 2.5.3): the heading buttons show "H1" to "H3" and the numbered list
 * shows "1.", which the default names do not contain.
 */
export const SITE_EDITOR_LABELS = {
  heading: (level: number) => `Heading ${level}, H${level}`,
  orderedList: 'Numbered list, 1.',
} as const;

/** The demo document, as the Markdown the editor loads at the untrusted tier. */
export const EDITOR_DEMO_MARKDOWN = [
  '## Launch notes',
  '',
  'The **pilot** starts on *Monday*. Keep ~~Friday~~ free and run `pnpm build` first. Read the [plan](https://example.com/plan).',
  '',
  '- Invite the review group',
  '- Share the agenda',
  '',
  '1. Draft the summary',
  '2. Collect feedback',
  '',
  '- [x] Book the room',
  '- [ ] Send the recap',
  '',
  '> Small pieces, shipped often.',
  '',
  '```ts',
  "const greeting = 'hello';",
  '```',
  '',
  '---',
  '',
  'Questions go to team@example.com.',
].join('\n');

export interface VocabularyRow {
  readonly name: string;
  readonly renders: string;
  readonly markdown: string;
}

/** Block nodes of the closed document model (`EDITOR_BLOCK_TYPES` in `@texuli/core`). */
export const EDITOR_NODES: readonly VocabularyRow[] = [
  { name: 'paragraph', renders: 'p', markdown: 'plain text' },
  { name: 'heading', renders: 'h1 to h4', markdown: '# to ####' },
  { name: 'list (bullet)', renders: 'ul, li', markdown: '- item' },
  { name: 'list (ordered)', renders: 'ol, li', markdown: '1. item' },
  {
    name: 'list (todo)',
    renders: 'ul, li with a checkbox outside the text',
    markdown: '- [ ] item',
  },
  { name: 'quote', renders: 'blockquote', markdown: '> text' },
  { name: 'code', renders: 'pre, code', markdown: 'a fenced block' },
  { name: 'divider', renders: 'hr', markdown: '---' },
  {
    name: 'media',
    renders: 'an image the host resolves',
    markdown: 'an image alone in a paragraph',
  },
];

/** Inline marks (`EDITOR_MARK_ORDER` in `@texuli/core`). */
export const EDITOR_MARKS: readonly VocabularyRow[] = [
  { name: 'strong', renders: 'strong', markdown: '**bold**' },
  { name: 'em', renders: 'em', markdown: '*italic*' },
  { name: 'strike', renders: 's', markdown: '~~struck~~' },
  { name: 'code', renders: 'code', markdown: '`code`' },
  {
    name: 'link',
    renders: 'a, checked by the URL policy',
    markdown: '[text](https://example.com)',
  },
];

export interface EditorDoc {
  readonly path: string;
  readonly summary: string;
}

export const EDITOR_DOCS: readonly EditorDoc[] = [
  { path: 'packages/editor/README.md', summary: 'what works today and what is not done yet' },
  {
    path: 'packages/editor/docs/editor-surface.md',
    summary: 'RichTextEditor and the editing surface',
  },
  { path: 'packages/editor/docs/editor-toolbar.md', summary: 'the formatting toolbar' },
  {
    path: 'packages/editor/docs/editor-link-dialog.md',
    summary: 'link editing through the URL policy',
  },
  {
    path: 'packages/editor/docs/editor-controller.md',
    summary: 'the headless controller, history and labels',
  },
  { path: 'packages/editor/docs/editor-paste.md', summary: 'clipboard import as data' },
  {
    path: 'packages/core/docs/core-editor.md',
    summary: 'the model, transforms, keymap and Markdown codec',
  },
  { path: 'docs/EDITOR_ARCHITECTURE.md', summary: 'the architecture contract' },
];

/** Registry examples that show the editor. */
export const EDITOR_EXAMPLES = [
  { id: 'editor-basic', title: 'Rich text editor' },
  { id: 'editor-toolbar', title: 'Editor with toolbar and links' },
  { id: 'editor-long-document', title: 'Long document editing' },
] as const;

export function editorExampleHref(base: string, id: string): string {
  return `${base.replace(/\/+$/, '')}/examples/${id}/`;
}
