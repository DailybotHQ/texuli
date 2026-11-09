import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type DocBlock, parseDocMarkdown } from '../parse.ts';

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

const DIR = import.meta.dirname;

/** Load every Workflows docs Markdown file, in reading order. */
export function loadWorkflowsDocs(): readonly WorkflowsDocSection[] {
  return WORKFLOWS_DOC_FILES.map((id) => {
    const source = readFileSync(join(DIR, `${id}.md`), 'utf8');
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
