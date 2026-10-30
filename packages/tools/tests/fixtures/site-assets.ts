/**
 * A fake `env.ASSETS` for the `site` operations (T-ar-site-mcp): a tiny
 * built site in memory, with `md-manifest.json` in the shape the website
 * build writes (`twins` plus `pages`) and one Markdown twin per page. It
 * records every path requested, so tests can prove the caller's text never
 * reaches the fetcher. Shared by the tools tests, the website's Function
 * tests and the agent evals.
 */
import type { SiteAssets } from '../../src/ops/index.ts';

export interface FixturePage {
  path: string;
  twin: string;
  title: string;
  description: string;
  headings: string[];
}

export const FIXTURE_PAGES: readonly FixturePage[] = [
  {
    path: '/',
    twin: '/index.md',
    title: 'Texuli',
    description: 'Small pieces. Infinite possibilities.',
    headings: ['For agents'],
  },
  {
    path: '/guides/',
    twin: '/guides.md',
    title: 'Guides',
    description: 'Every guide in one place.',
    headings: ['Start here', 'Theming and tokens'],
  },
  {
    path: '/guides/theming/',
    twin: '/guides/theming.md',
    title: 'Theming',
    description: 'Pick a library theme and compile CSS variables.',
    headings: ['CSS layers', 'Dark mode', 'Custom themes'],
  },
  {
    path: '/guides/dark-mode/',
    twin: '/guides/dark-mode.md',
    title: 'Dark mode',
    description: 'Light, dark and system appearance without a flash.',
    headings: ['The no-flash script', 'Theming each mode'],
  },
  {
    path: '/component-pages/card/',
    twin: '/component-pages/card.md',
    title: 'Card',
    description: 'A surface that groups related content.',
    headings: ['Props', 'Examples', 'Accessibility'],
  },
  {
    path: '/theme-studio/',
    twin: '/theme-studio.md',
    title: 'Theme studio',
    description: 'Build a theme and export its CSS.',
    headings: ['For agents'],
  },
];

/** The twin text of a fixture page: a header block and the headings as sections. */
export function fixtureTwin(page: FixturePage): string {
  const sections = page.headings.map((heading) => `## ${heading}\n\nFictional text.\n`).join('\n');
  return `# ${page.title}\n\n> ${page.description}\n\nLanguage: en\nCanonical: https://texuli.com${page.path}\n\n---\n\n${sections}`;
}

export interface FakeSiteAssets extends SiteAssets {
  /** Every path requested, in order. */
  requested: string[];
}

/**
 * The fake binding. `files` overrides or adds files by path (a string body,
 * or `null` for a 404); `manifest: false` removes the manifest.
 */
export function fakeSiteAssets(
  options: { pages?: readonly FixturePage[]; files?: Record<string, string | null> } = {}
): FakeSiteAssets {
  const pages = options.pages ?? FIXTURE_PAGES;
  const files = new Map<string, string | null>();
  files.set(
    '/md-manifest.json',
    JSON.stringify({
      twins: Object.fromEntries(pages.map((page) => [page.path, page.twin])),
      pages,
    })
  );
  for (const page of pages) files.set(page.twin, fixtureTwin(page));
  for (const [path, body] of Object.entries(options.files ?? {})) files.set(path, body);
  const requested: string[] = [];
  return {
    requested,
    async fetch(request: Request) {
      const path = new URL(request.url).pathname;
      requested.push(path);
      const body = files.get(path);
      if (body === undefined || body === null) return new Response('Not found', { status: 404 });
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': path.endsWith('.json')
            ? 'application/json'
            : 'text/markdown; charset=utf-8',
        },
      });
    },
  };
}
