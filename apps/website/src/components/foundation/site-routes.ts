/**
 * Which site routes have an Astro page on disk. Dependency-free (no site data), so any build-time
 * module can ask without an import cycle; `nav-data.ts` re-exports `siteRouteExists`.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `apps/website/src/pages` on disk. `astro build` runs from `apps/website` and bundles this
 * module into a chunk folder (so `import.meta.dirname` no longer points here); Vitest runs from
 * the repository root. The candidates are tried lazily, in that order, and a miss is an error:
 * a silent fallback would drop every conditional nav, footer and home link from the build.
 */
let pagesDir: string | undefined;
function pagesDirectory(): string {
  if (pagesDir) return pagesDir;
  const candidates = [
    () => join(process.cwd(), 'src/pages'),
    () => join(process.cwd(), 'apps/website/src/pages'),
    () => (import.meta.dirname ? join(import.meta.dirname, '../../pages') : ''),
  ];
  for (const candidate of candidates) {
    const dir = candidate();
    if (dir && existsSync(join(dir, 'index.astro'))) {
      pagesDir = dir;
      return dir;
    }
  }
  throw new Error(
    `siteRouteExists: no src/pages folder found from ${process.cwd()}; run the build from apps/website or the repository root`
  );
}

/**
 * Whether a site-relative path has an Astro page today. Used so the header
 * never ships a Solutions or Built-with href before its page exists (ADR-031).
 */
export function siteRouteExists(href: string): boolean {
  const path = href.split('#')[0]?.split('?')[0] ?? '';
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  const rel = path.replace(/^\/+|\/+$/g, '');
  const root = pagesDirectory();
  const folder = rel === '' ? root : join(root, rel);
  return existsSync(join(folder, 'index.astro')) || existsSync(`${folder}.astro`);
}
