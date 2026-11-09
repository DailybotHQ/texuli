import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type DocBlock, parseDocMarkdown } from '../parse.ts';

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

const DIR = import.meta.dirname;

/** Load every Documents docs Markdown file, in reading order. */
export function loadDocumentsDocs(): readonly DocumentsDocSection[] {
  return DOCUMENTS_DOC_FILES.map((id) => {
    const source = readFileSync(join(DIR, `${id}.md`), 'utf8');
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
