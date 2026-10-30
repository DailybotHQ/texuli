/**
 * Build integration for "Copy page" (FIX-site-sidebar-nav) and the Markdown
 * twins (T-23, extended to every page by PLAN_011 T-ar-twins). After
 * `astro build`, each docs page's content between the layout's
 * `<!--tx-page-body-->` markers is converted to Markdown and appended, as
 * escaped text, to the page's `<template data-page-markdown>`. Then every
 * built HTML page outside the `TWIN_EXEMPTIONS` allowlist gets its twin
 * beside it (`/` → `index.md`, `guides/theming/index.html` →
 * `guides/theming.md`): the header block (Language, Canonical, the Markdown
 * access line, Last Updated from the same git dates as the sitemap), the
 * page's content, and a "For agents" note on interactive pages
 * (`twins.ts`, `twin-notes.ts`). `md-manifest.json` maps every page route to
 * its twin (`twins`) and lists every page with its title, description and
 * h2/h3 headings (`pages`, read by the remote MCP's `site.*` operations).
 * Working on the built HTML keeps the page render single: the layout never
 * renders its slot twice. Static files only; nothing runs at request time.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { texuliOps } from '@texuli/tools/ops';
import type { AstroIntegration } from 'astro';
import { pageRoute } from '../security/csp.ts';
import { readPageMeta } from '../seo/seo.ts';
import { htmlToMarkdown } from './markdown.ts';
import { agentNoteMarkdown } from './twin-notes.ts';
import {
  isRedirectStub,
  pageLanguage,
  renderTwin,
  TWIN_EXEMPTIONS,
  type TwinIndexEntry,
  twinIndexEntry,
  twinPathFor,
} from './twins.ts';

const BODY = /<!--tx-page-body-->([\s\S]*?)<!--\/tx-page-body-->/;
const TEMPLATE = /(<template data-page-markdown=""[^>]*>)([\s\S]*?)(<\/template>)/;

/** Text for a `<template>`: the parser decodes it back for `textContent`. */
export function escapeTemplateText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The inverse of `escapeTemplateText`. */
export function unescapeTemplateText(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/**
 * The built page with its Markdown filled in, or `null` when the page has no
 * "Copy page" template. The body markers are removed either way.
 */
export function fillPageMarkdown(html: string): string | null {
  const body = BODY.exec(html);
  if (!body || !TEMPLATE.test(html)) return null;
  const markdown = escapeTemplateText(htmlToMarkdown(body[1] ?? ''));
  return html
    .replace(TEMPLATE, (_match, open: string, head: string, close: string) => {
      return `${open}${head}${markdown}${close}`;
    })
    .replace('<!--tx-page-body-->', '')
    .replace('<!--/tx-page-body-->', '');
}

/** The page's Markdown as the template carries it (head + body), unescaped. */
export function pageMarkdownOf(filledHtml: string): string | null {
  const match = TEMPLATE.exec(filledHtml);
  return match ? unescapeTemplateText(match[2] ?? '') : null;
}

/** Every `.html` file under `dir`, recursively. */
async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(path);
      return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
    })
  );
  return files.flat();
}

export function copyPageIntegration(): AstroIntegration {
  let site: string | undefined;
  return {
    name: 'texuli-copy-page',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site ? new URL(config.site).origin : undefined;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        // Loaded here, not at module scope: the SEO integration resolves its
        // own files from `import.meta.url`, which only a build run provides.
        const { routeLastmod } = await import('../seo/integration.ts');
        let filled = 0;
        let exempt = 0;
        const twins: Record<string, string> = {};
        const pages: TwinIndexEntry[] = [];
        const operations = texuliOps
          .list({ runtimes: ['edge'] })
          .map(({ name, title }) => ({ name, title }));
        for (const file of (await htmlFiles(out)).sort()) {
          const route = pageRoute(out, file);
          const html = await readFile(file, 'utf8');
          const marked = html.includes('<!--tx-page-body-->');
          if (marked) {
            // "Copy page" on docs pages; the markers go either way.
            const next = fillPageMarkdown(html);
            if (next) filled += 1;
            await writeFile(
              file,
              next ?? html.replace('<!--tx-page-body-->', '').replace('<!--/tx-page-body-->', '')
            );
          }
          // The twin (T-ar-twins): every page but the allowlist, from the
          // page's own content (the HTML before the markers were removed).
          const twin = twinPathFor(route);
          if (!site || !twin || isRedirectStub(html)) {
            exempt += 1;
            continue;
          }
          const meta = readPageMeta(html);
          const markdown = renderTwin({
            route,
            html,
            facts: {
              title: meta.title,
              description: meta.description,
              language: pageLanguage(html),
            },
            origin: site,
            lastUpdated: routeLastmod(route),
            note: agentNoteMarkdown(route, operations, site),
          });
          await writeFile(join(out, twin.slice(1)), markdown, 'utf8');
          twins[route] = twin;
          pages.push(twinIndexEntry(route, twin, markdown, meta.description));
        }
        await writeFile(
          join(out, 'md-manifest.json'),
          `${JSON.stringify({ twins, pages }, null, 2)}\n`,
          'utf8'
        );
        logger.info(
          `"Copy page" Markdown written for ${filled} pages; ${Object.keys(twins).length} Markdown twins written (${exempt} HTML files exempt: ${TWIN_EXEMPTIONS.map((entry) => entry.pattern.source).join(', ')}).`
        );
      },
    },
  };
}
