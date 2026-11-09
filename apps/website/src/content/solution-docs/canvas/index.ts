import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

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

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load every Canvas docs Markdown file, in reading order. */
export function loadCanvasDocs(): readonly CanvasDocSection[] {
  return CANVAS_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
