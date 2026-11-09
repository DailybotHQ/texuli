import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

export const WORKFLOWS_DOC_FILES = [
  'overview',
  'quickstart',
  'model',
  'integration',
  'a11y',
  'limits',
  'agents',
] as const;

export type WorkflowsDocFile = (typeof WORKFLOWS_DOC_FILES)[number];

export interface WorkflowsDocSection {
  readonly id: WorkflowsDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load every Workflows docs Markdown file, in reading order. */
export function loadWorkflowsDocs(): readonly WorkflowsDocSection[] {
  return WORKFLOWS_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
