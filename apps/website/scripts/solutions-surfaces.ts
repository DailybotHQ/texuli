/**
 * Prints or checks the registry-generated agent surfaces (ADR-029): the
 * `/solutions/index.json` document, the llms.txt "Solutions" and "Built with Texuli"
 * sections, and the registry routes that must have Markdown twins and sitemap entries.
 *
 *     pnpm exec tsx apps/website/scripts/solutions-surfaces.ts            # print all as JSON
 *     pnpm exec tsx apps/website/scripts/solutions-surfaces.ts --index    # print index.json
 *     pnpm exec tsx apps/website/scripts/solutions-surfaces.ts --check-dist apps/website/dist
 *
 * `--check-dist` reads a built site and fails (exit 1) when a registry route that exists
 * in `src/pages/` has no HTML page, no Markdown twin or no sitemap entry. It writes nothing:
 * the twins and the sitemap are produced by the build integrations, and `/solutions/index.json`
 * is served from `solutionsIndexDocument` by its page route.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  registryLlmsSections,
  registryRoutes,
  solutionsIndexDocument,
} from '../src/lib/twins/solutions.ts';

export const SITE_URL = 'https://texuli.com';

/** Problems with a built `dist/` for the registry routes; empty means covered. */
export function checkDist(
  dist: string,
  siteUrl: string = SITE_URL,
  routes: readonly { route: string }[] = registryRoutes()
): string[] {
  const problems: string[] = [];
  const sitemapPath = join(dist, 'sitemap.xml');
  const sitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, 'utf8') : '';
  if (!sitemap) problems.push('dist/sitemap.xml is missing');
  for (const { route } of routes) {
    const rel = route.replace(/^\/+|\/+$/g, '');
    if (!existsSync(join(dist, rel, 'index.html'))) problems.push(`${route}: no built page`);
    if (!existsSync(join(dist, `${rel}.md`))) problems.push(`${route}: no Markdown twin`);
    if (sitemap && !sitemap.includes(`<loc>${siteUrl}${route}</loc>`))
      problems.push(`${route}: not in sitemap.xml`);
  }
  return problems;
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const distAt = args.indexOf('--check-dist');
  if (distAt >= 0) {
    const dist = args[distAt + 1];
    if (!dist) {
      console.error('--check-dist needs the built site directory');
      process.exit(2);
    }
    const problems = checkDist(resolve(dist));
    for (const problem of problems) console.error(problem);
    console.log(
      `[solutions-surfaces] ${registryRoutes().length} registry routes, ${problems.length} problems`
    );
    process.exit(problems.length === 0 ? 0 : 1);
  }
  const out = args.includes('--index')
    ? solutionsIndexDocument(SITE_URL)
    : {
        routes: registryRoutes(),
        llms: registryLlmsSections(SITE_URL),
        index: solutionsIndexDocument(SITE_URL),
      };
  console.log(JSON.stringify(out, null, 2));
}
