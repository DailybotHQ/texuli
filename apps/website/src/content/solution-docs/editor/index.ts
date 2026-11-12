import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

export const EDITOR_DOC_FILES = [
  'install',
  'markdown',
  'paste',
  'block-menu',
  'emoji',
  'export',
] as const;

export type EditorDocFile = (typeof EDITOR_DOC_FILES)[number];

export interface EditorDocSection {
  readonly id: EditorDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load every Rich text editor docs Markdown file, in reading order. */
export function loadEditorDocs(): readonly EditorDocSection[] {
  return EDITOR_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
