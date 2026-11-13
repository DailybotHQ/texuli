import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

export const FORMS_DOC_FILES = ['install', 'schemas', 'drafts', 'builder'] as const;

export type FormsDocFile = (typeof FORMS_DOC_FILES)[number];

export interface FormsDocSection {
  readonly id: FormsDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load every Forms docs Markdown file, in reading order. */
export function loadFormsDocs(): readonly FormsDocSection[] {
  return FORMS_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
