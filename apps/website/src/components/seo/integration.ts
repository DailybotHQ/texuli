/**
 * Build integration for texuli.com SEO (T-site-seo). After `astro build`,
 * for every generated page it reads the built `<title>` and description,
 * renders a social image (SVG → PNG through Astro's own sharp image
 * service, so no extra dependency), and writes `sitemap.xml` and
 * `robots.txt`. Everything is a static file; nothing runs at request time.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import {
  absoluteUrl,
  buildRobots,
  buildSitemap,
  normalizePagePath,
  OG_IMAGE_WIDTH,
  ogAreaFor,
  ogImageFile,
  ogImageSvg,
  readPageMeta,
  SEO_EXCLUDED,
  type SitemapEntry,
} from './seo.ts';

/** The designed social card for the home page (1200 x 630 PNG). */
const HOME_OG_IMAGE = fileURLToPath(new URL('./og-home.png', import.meta.url));

type SharpService = {
  transform: (
    input: Uint8Array,
    transform: { src: string; format: 'png'; width: number },
    imageConfig: Record<string, unknown>,
    logger: unknown
  ) => Promise<{ data: Uint8Array }>;
};

const SITE_NAME = 'Texuli';

/**
 * Per-page sitemap dates from git (T-20): a route's lastmod is the last
 * commit date that touched its source. Static routes map to their
 * `src/pages/**` file; the dynamic `[id].astro` routes map to their template
 * plus the package area that feeds them. Unmapped routes fall back to HEAD.
 */
const sourceDates = new Map<string, string>();

/**
 * The last commit date (for `gitArgs`, e.g. `['--', path]`) as a UTC
 * `YYYY-MM-DD`. `%cs` would be the committer's own calendar day, which runs
 * up to 14 hours ahead of UTC; the sitemap gates compare lastmod with UTC, so
 * the date is formatted in the local zone with `TZ=UTC` forced on the child.
 */
export function gitCommitDateUtc(gitArgs: readonly string[], cwd?: string): string {
  return execFileSync(
    'git',
    ['log', '-1', '--date=format-local:%Y-%m-%d', '--format=%cd', ...gitArgs],
    { encoding: 'utf8', cwd, env: { ...process.env, TZ: 'UTC' } }
  ).trim();
}

function gitDate(path: string): string | undefined {
  if (!sourceDates.has(path)) {
    let date = '';
    try {
      date = gitCommitDateUtc(['--', path]);
    } catch {
      date = '';
    }
    if (date) sourceDates.set(path, date);
  }
  return sourceDates.get(path);
}

/** HEAD's commit date; a non-git build fails loudly instead of lying. */
function headDate(): string {
  return gitCommitDateUtc([]);
}

function routeLastmod(path: string): string {
  const latest = (...candidates: string[]) => {
    const dates = candidates
      .map(gitDate)
      .filter((date): date is string => Boolean(date))
      .sort();
    return dates.at(-1);
  };
  const date = /^\/component-pages\/[^/]+\/$/.test(path)
    ? latest('src/pages/component-pages/[id].astro', '../../packages/catalog/src/manifests')
    : /^\/primitives-page\/[^/]+\/$/.test(path)
      ? latest('src/pages/primitives-page/[id].astro', '../../packages/primitives/src')
      : (() => {
          const rel = path === '/' ? '' : path.slice(1);
          return latest(`src/pages/${rel}index.astro`, `src/pages/${rel.replace(/\/$/, '')}.astro`);
        })();
  return date ?? gitDate('.') ?? headDate();
}

export function seoIntegration(): AstroIntegration {
  let site: string | URL | undefined;
  let base = '/';
  return {
    name: 'texuli-seo',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site;
        base = config.base;
      },
      'astro:build:done': async ({ dir, pages, logger }) => {
        if (!site) {
          logger.warn('No `site` configured: skipping sitemap, robots and social images.');
          return;
        }
        const out = fileURLToPath(dir);
        const { default: sharp } = (await import('astro/assets/services/sharp')) as unknown as {
          default: SharpService;
        };
        // A 256-color palette keeps each image near 26 KB (from 69 KB) with no visible banding.
        const imageConfig = {
          service: {
            entrypoint: 'astro/assets/services/sharp',
            config: { png: { palette: true, compressionLevel: 9, effort: 8 } },
          },
          dangerouslyProcessSVG: true,
        };
        const entries: SitemapEntry[] = [];
        let images = 0;
        for (const { pathname } of pages) {
          const path = normalizePagePath(pathname);
          if (SEO_EXCLUDED.has(path)) continue;
          const htmlFile = join(out, path === '/' ? 'index.html' : `${path.slice(1)}index.html`);
          let html: string;
          try {
            html = await readFile(htmlFile, 'utf8');
          } catch {
            continue;
          }
          const meta = readPageMeta(html);
          if (meta.noindex) continue;
          entries.push({ loc: absoluteUrl(site, base, path), lastmod: routeLastmod(path) });
          const display = absoluteUrl(site, base, path)
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '');
          const file = join(out, ogImageFile(path));
          await mkdir(dirname(file), { recursive: true });
          // The home page carries the designed brand card (1200 x 630, from
          // brand/social/texuli-og-source.png); every other page gets its own
          // generated card.
          if (path === '/') {
            await writeFile(file, await readFile(HOME_OG_IMAGE));
            images += 1;
            continue;
          }
          const svg = ogImageSvg({
            title: meta.title.replace(/\s+\u00b7\s+Texuli$/, '') || SITE_NAME,
            description: meta.description,
            url: display,
            siteName: SITE_NAME,
            area: ogAreaFor(path),
          });
          const png = await sharp.transform(
            new TextEncoder().encode(svg),
            { src: 'og.svg', format: 'png', width: OG_IMAGE_WIDTH },
            imageConfig,
            logger
          );
          await writeFile(file, png.data);
          images += 1;
        }
        const sitemapUrl = absoluteUrl(site, base, 'sitemap.xml');
        await writeFile(join(out, 'sitemap.xml'), buildSitemap(entries));
        await writeFile(join(out, 'robots.txt'), buildRobots(sitemapUrl));
        logger.info(
          `sitemap.xml (${entries.length} pages with lastmod), robots.txt and ${images} social images written.`
        );
      },
    },
  };
}
