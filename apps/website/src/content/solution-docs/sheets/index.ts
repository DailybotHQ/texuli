import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type DocBlock, parseDocMarkdown } from '../parse.ts';

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

const DIR = import.meta.dirname;

/** Load every Sheets docs Markdown file, in reading order. */
export function loadSheetsDocs(): readonly SheetsDocSection[] {
  return SHEETS_DOC_FILES.map((id) => {
    const source = readFileSync(join(DIR, `${id}.md`), 'utf8');
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
