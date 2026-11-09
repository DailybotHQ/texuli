import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type DocBlock, parseDocMarkdown } from '../parse.ts';

export const SLIDES_DOC_FILES = [
  'overview',
  'quickstart',
  'model',
  'integration',
  'a11y',
  'limits',
  'agents',
] as const;

export type SlidesDocFile = (typeof SLIDES_DOC_FILES)[number];

export interface SlidesDocSection {
  readonly id: SlidesDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const DIR = import.meta.dirname;

/** Load every Slides docs Markdown file, in reading order. */
export function loadSlidesDocs(): readonly SlidesDocSection[] {
  return SLIDES_DOC_FILES.map((id) => {
    const source = readFileSync(join(DIR, `${id}.md`), 'utf8');
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
