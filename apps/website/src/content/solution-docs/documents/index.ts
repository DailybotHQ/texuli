import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

export const DOCUMENTS_DOC_FILES = [
  'overview',
  'quickstart',
  'model',
  'integration',
  'a11y',
  'limits',
  'agents',
] as const;

export type DocumentsDocFile = (typeof DOCUMENTS_DOC_FILES)[number];

export interface DocumentsDocSection {
  readonly id: DocumentsDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load every Documents docs Markdown file, in reading order. */
export function loadDocumentsDocs(): readonly DocumentsDocSection[] {
  return DOCUMENTS_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
