import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type DocBlock, parseDocMarkdown } from '../parse.ts';

export const CANVAS_DOC_FILES = [
  'overview',
  'quickstart',
  'model',
  'integration',
  'a11y',
  'limits',
  'agents',
] as const;

export type CanvasDocFile = (typeof CANVAS_DOC_FILES)[number];

export interface CanvasDocSection {
  readonly id: CanvasDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const DIR = import.meta.dirname;

/** Load every Canvas docs Markdown file, in reading order. */
export function loadCanvasDocs(): readonly CanvasDocSection[] {
  return CANVAS_DOC_FILES.map((id) => {
    const source = readFileSync(join(DIR, `${id}.md`), 'utf8');
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
