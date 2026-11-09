/**
 * A fake texuli.com for the Solution agent evals: the files an agent reads before it calls
 * a tool, built from the repository's committed sources, with no build and no network.
 *
 * - `/llms.txt`: the committed `apps/website/public/llms.txt`.
 * - `/solutions/index.json`: `solutionsIndexDocument`, which the site prerenders from the
 *   registry (`apps/website/src/pages/solutions/index.json.ts`).
 * - `/md-manifest.json` and one Markdown twin per Solution docs page
 *   (`/guides/solutions/<slug>/`), made from the docs content the page renders
 *   (`apps/website/src/content/solution-docs/<slug>/`), so `site.read` answers with the real
 *   docs text.
 *
 * `fetch` has the `env.ASSETS` shape the remote MCP door (`functions/mcp.ts`) reads.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCanvasDocs } from '../../../apps/website/src/content/solution-docs/canvas/index.ts';
import { loadDocumentsDocs } from '../../../apps/website/src/content/solution-docs/documents/index.ts';
import { loadSheetsDocs } from '../../../apps/website/src/content/solution-docs/sheets/index.ts';
import { loadSlidesDocs } from '../../../apps/website/src/content/solution-docs/slides/index.ts';
import { loadWorkflowsDocs } from '../../../apps/website/src/content/solution-docs/workflows/index.ts';
import { SOLUTIONS } from '../../../apps/website/src/data/solutions/index.ts';
import type { SolutionSlug } from '../../../apps/website/src/data/solutions/schema.ts';
import { solutionsIndexDocument } from '../../../apps/website/src/lib/twins/solutions.ts';

export const SITE = 'https://texuli.com';
const REPO = resolve(import.meta.dirname, '../../..');

/** The docs sections of each Solution, in reading order (the docs page renders these). */
const DOCS: Readonly<Record<SolutionSlug, () => readonly { id: string; source: string }[]>> = {
  slides: loadSlidesDocs,
  documents: loadDocumentsDocs,
  workflows: loadWorkflowsDocs,
  canvas: loadCanvasDocs,
  sheets: loadSheetsDocs,
};

/** The twin of a Solution docs page: a header block, then every docs section. */
export function docsTwin(slug: SolutionSlug): string {
  const entry = SOLUTIONS.find((s) => s.slug === slug);
  if (!entry) throw new Error(`no registry entry for ${slug}`);
  const body = DOCS[slug]()
    .map((section) => section.source.trim())
    .join('\n\n');
  return `# ${entry.name} docs\n\n> ${entry.tagline}\n\nLanguage: en\nCanonical: ${SITE}${entry.docs}\n\n---\n\n${body}\n`;
}

export interface SolutionsSite {
  fetch(request: Request): Promise<Response>;
  /** Every path requested, in order. */
  readonly requested: string[];
}

/** The fake site. */
export function solutionsSite(): SolutionsSite {
  const files = new Map<string, string>();
  files.set('/llms.txt', readFileSync(resolve(REPO, 'apps/website/public/llms.txt'), 'utf8'));
  files.set('/solutions/index.json', JSON.stringify(solutionsIndexDocument(SITE)));
  const pages = SOLUTIONS.map((entry) => ({
    path: entry.docs,
    twin: `${entry.docs.replace(/\/$/, '')}.md`,
    title: `${entry.name} docs`,
    description: entry.tagline,
    headings: [],
  }));
  files.set(
    '/md-manifest.json',
    JSON.stringify({ twins: Object.fromEntries(pages.map((p) => [p.path, p.twin])), pages })
  );
  for (const entry of SOLUTIONS)
    files.set(`${entry.docs.replace(/\/$/, '')}.md`, docsTwin(entry.slug));
  const requested: string[] = [];
  return {
    requested,
    async fetch(request: Request) {
      const path = new URL(request.url).pathname;
      requested.push(path);
      const body = files.get(path);
      if (body === undefined) return new Response('Not found', { status: 404 });
      const type = path.endsWith('.json')
        ? 'application/json'
        : path.endsWith('.txt')
          ? 'text/plain; charset=utf-8'
          : 'text/markdown; charset=utf-8';
      return new Response(body, { status: 200, headers: { 'content-type': type } });
    },
  };
}

/** The `- [Title](url): note` links of one `## Section` of an llms.txt. */
export function llmsSection(llms: string, name: string): { title: string; url: string }[] {
  const start = llms.indexOf(`\n## ${name}\n`);
  if (start < 0) return [];
  const rest = llms.slice(start + name.length + 5);
  const end = rest.indexOf('\n## ');
  const section = end < 0 ? rest : rest.slice(0, end);
  return [...section.matchAll(/^- \[([^\]]+)\]\(([^)]+)\)/gm)].map((m) => ({
    title: m[1] as string,
    url: m[2] as string,
  }));
}
