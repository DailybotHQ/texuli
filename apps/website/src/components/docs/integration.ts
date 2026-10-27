/**
 * Build integration for "Copy page" (FIX-site-sidebar-nav) and the markdown
 * twins (T-23). After `astro build`, each docs page's content between the
 * layout's `<!--tx-page-body-->` markers is converted to Markdown and
 * appended, as escaped text, to the page's `<template data-page-markdown>`;
 * the same text is also written as the page's twin (`guides/theming.md`
 * beside `guides/theming/index.html`), with root-relative links made
 * absolute. `md-manifest.json` records every twin for the negotiation
 * slice (T-26). Working on the built HTML keeps the page render single: the
 * layout never renders its slot twice. Static files only; nothing runs at
 * request time.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { absolutizeMarkdownLinks, htmlToMarkdown } from './markdown.ts';

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

export function copyPageIntegration(): AstroIntegration {
  let site: string | undefined;
  return {
    name: 'texuli-copy-page',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site ? new URL(config.site).origin : undefined;
      },
      'astro:build:done': async ({ dir, pages, logger }) => {
        const out = fileURLToPath(dir);
        let filled = 0;
        const twins: Record<string, string> = {};
        for (const { pathname } of pages) {
          const path = pathname.replace(/^\/+|\/+$/g, '');
          const file = join(out, path ? `${path}/index.html` : 'index.html');
          let html: string;
          try {
            html = await readFile(file, 'utf8');
          } catch {
            continue;
          }
          if (!html.includes('<!--tx-page-body-->')) continue;
          const next = fillPageMarkdown(html);
          await writeFile(
            file,
            next ?? html.replace('<!--tx-page-body-->', '').replace('<!--/tx-page-body-->', '')
          );
          if (!next) continue;
          filled += 1;
          // The twin: the exact "Copy page" text, links absolute, written
          // beside the page (`guides/theming.md`).
          const markdown = pageMarkdownOf(next);
          if (markdown && site && path) {
            const twinRel = `${path}.md`;
            await writeFile(join(out, twinRel), absolutizeMarkdownLinks(markdown, site), 'utf8');
            twins[`/${path}/`] = `/${twinRel}`;
          }
        }
        await writeFile(
          join(out, 'md-manifest.json'),
          `${JSON.stringify({ twins }, null, 2)}\n`,
          'utf8'
        );
        logger.info(
          `"Copy page" Markdown written for ${filled} pages (${Object.keys(twins).length} twins).`
        );
      },
    },
  };
}
