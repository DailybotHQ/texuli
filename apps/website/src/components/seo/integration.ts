/**
 * Build integration for texuli.com SEO (T-site-seo). After `astro build`,
 * for every generated page it reads the built `<title>` and description,
 * renders a social image (SVG → PNG through Astro's own sharp image
 * service, so no extra dependency), and writes `sitemap.xml` and
 * `robots.txt`. Everything is a static file; nothing runs at request time.
 */
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
  ogImageFile,
  ogImageSvg,
  readPageMeta,
  SEO_EXCLUDED,
} from './seo.ts';

type SharpService = {
  transform: (
    input: Uint8Array,
    transform: { src: string; format: 'png'; width: number },
    imageConfig: Record<string, unknown>,
    logger: unknown
  ) => Promise<{ data: Uint8Array }>;
};

const SITE_NAME = 'Texuli';

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
        const urls: string[] = [];
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
          urls.push(absoluteUrl(site, base, path));
          const display = absoluteUrl(site, base, path)
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '');
          const svg = ogImageSvg({
            title: meta.title.replace(/\s+\u00b7\s+Texuli$/, '') || SITE_NAME,
            description: meta.description,
            url: display,
            siteName: SITE_NAME,
          });
          const png = await sharp.transform(
            new TextEncoder().encode(svg),
            { src: 'og.svg', format: 'png', width: OG_IMAGE_WIDTH },
            imageConfig,
            logger
          );
          const file = join(out, ogImageFile(path));
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, png.data);
          images += 1;
        }
        const sitemapUrl = absoluteUrl(site, base, 'sitemap.xml');
        await writeFile(join(out, 'sitemap.xml'), buildSitemap(urls));
        await writeFile(join(out, 'robots.txt'), buildRobots(sitemapUrl));
        logger.info(
          `sitemap.xml (${urls.length} pages), robots.txt and ${images} social images written.`
        );
      },
    },
  };
}
