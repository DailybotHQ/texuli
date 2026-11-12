import { type DocBlock, docSource, parseDocMarkdown } from '../parse.ts';

export const DASHBOARDS_DOC_FILES = [
  'overview',
  'quickstart',
  'model',
  'integration',
  'a11y',
  'limits',
  'agents',
] as const;

export type DashboardsDocFile = (typeof DASHBOARDS_DOC_FILES)[number];

export interface DashboardsDocSection {
  readonly id: DashboardsDocFile;
  readonly source: string;
  readonly blocks: readonly DocBlock[];
}

const FILES: Readonly<Record<string, string>> = import.meta.glob('./*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Load the Dashboards docs in reading order. */
export function loadDashboardsDocs(): readonly DashboardsDocSection[] {
  return DASHBOARDS_DOC_FILES.map((id) => {
    const source = docSource(FILES, id);
    return { id, source, blocks: parseDocMarkdown(source) };
  });
}
