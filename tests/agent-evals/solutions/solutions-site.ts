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
 *   docs text. Design systems has no `solution-docs` content: its docs page is a short Astro
 *   page (`apps/website/src/pages/guides/solutions/design-systems/index.astro`), so its twin
 *   is that page's template text with the markup removed.
 *
 * `fetch` has the `env.ASSETS` shape the remote MCP door (`functions/mcp.ts`) reads.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadAgentChatDocs } from '../../../apps/website/src/content/solution-docs/agent-chat/index.ts';
import { loadCanvasDocs } from '../../../apps/website/src/content/solution-docs/canvas/index.ts';
import { loadDashboardsDocs } from '../../../apps/website/src/content/solution-docs/dashboards/index.ts';
import { loadDocumentsDocs } from '../../../apps/website/src/content/solution-docs/documents/index.ts';
import { loadEditorDocs } from '../../../apps/website/src/content/solution-docs/editor/index.ts';
import { loadFormsDocs } from '../../../apps/website/src/content/solution-docs/forms/index.ts';
import { loadSheetsDocs } from '../../../apps/website/src/content/solution-docs/sheets/index.ts';
import { loadSlidesDocs } from '../../../apps/website/src/content/solution-docs/slides/index.ts';
import { loadWorkflowsDocs } from '../../../apps/website/src/content/solution-docs/workflows/index.ts';
import { SOLUTIONS } from '../../../apps/website/src/data/solutions/index.ts';
import type { SolutionSlug } from '../../../apps/website/src/data/solutions/schema.ts';
import { solutionsIndexDocument } from '../../../apps/website/src/lib/twins/solutions.ts';

export const SITE = 'https://texuli.com';
const REPO = resolve(import.meta.dirname, '../../..');

/**
 * The design-systems docs page as text: each `<section>` of the committed Astro template,
 * headings as `##`, list items as `-`, every other tag removed. Text only, never executed.
 */
export function loadDesignSystemsDocs(): readonly { id: string; source: string }[] {
  const page = readFileSync(
    resolve(REPO, 'apps/website/src/pages/guides/solutions/design-systems/index.astro'),
    'utf8'
  );
  const template = page.slice(page.indexOf('---', 3) + 3);
  return [...template.matchAll(/<section>([\s\S]*?)<\/section>/g)].map((match, index) => {
    const source = (match[1] as string)
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '## $1\n')
      .replace(/<li>([\s\S]*?)<\/li>/g, '- $1\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();
    return { id: `section-${index + 1}`, source };
  });
}

/**
 * The docs sections of each Solution whose docs page ships, in reading order. A Solution joins
 * here when its `/guides/solutions/<slug>/` page lands; `solutions.test.ts` checks the pages on
 * disk against this map.
 */
export const DOCS: Readonly<
  Partial<Record<SolutionSlug, () => readonly { id: string; source: string }[]>>
> = {
  slides: loadSlidesDocs,
  documents: loadDocumentsDocs,
  workflows: loadWorkflowsDocs,
  canvas: loadCanvasDocs,
  sheets: loadSheetsDocs,
  'design-systems': loadDesignSystemsDocs,
  forms: loadFormsDocs,
  dashboards: loadDashboardsDocs,
  'agent-chat': loadAgentChatDocs,
  editor: loadEditorDocs,
};

/** The twin of a Solution docs page: a header block, then every docs section. */
export function docsTwin(slug: SolutionSlug): string {
  const entry = SOLUTIONS.find((s) => s.slug === slug);
  if (!entry) throw new Error(`no registry entry for ${slug}`);
  const load = DOCS[slug];
  if (!load) throw new Error(`no docs for ${slug}`);
  const body = load()
    .map((section) => section.source.trim())
    .join('\n\n');
  return `# ${entry.name} docs\n\n> ${entry.tagline}\n\nLanguage: en\nCanonical: ${SITE}${entry.docs}\n\n---\n\n${body}\n`;
}

export interface SolutionsSite {
  fetch(request: Request): Promise<Response>;
  /** Every path requested, in order. */
  readonly requested: string[];
}

/** Registry entries whose docs page ships. */
export const DOCUMENTED = SOLUTIONS.filter((entry) => DOCS[entry.slug] !== undefined);

/** The fake site. */
export function solutionsSite(): SolutionsSite {
  const files = new Map<string, string>();
  files.set('/llms.txt', readFileSync(resolve(REPO, 'apps/website/public/llms.txt'), 'utf8'));
  files.set('/solutions/index.json', JSON.stringify(solutionsIndexDocument(SITE)));
  const pages = DOCUMENTED.map((entry) => ({
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
  for (const entry of DOCUMENTED)
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
