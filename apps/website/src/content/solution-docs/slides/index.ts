import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

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

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load every Slides docs Markdown file, in reading order. */
export function loadSlidesDocs(): readonly SlidesDocSection[] {
  return SLIDES_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
