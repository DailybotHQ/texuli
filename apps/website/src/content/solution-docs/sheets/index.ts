import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

export const SHEETS_DOC_FILES = [
  'overview',
  'quickstart',
  'model',
  'integration',
  'a11y',
  'limits',
  'agents',
] as const;

export type SheetsDocFile = (typeof SHEETS_DOC_FILES)[number];

export interface SheetsDocSection {
  readonly id: SheetsDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load every Sheets docs Markdown file, in reading order. */
export function loadSheetsDocs(): readonly SheetsDocSection[] {
  return SHEETS_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
