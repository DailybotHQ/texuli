/**
 * Build integration for "Copy page" (FIX-site-sidebar-nav). After
 * `astro build`, each docs page's content between the layout's
 * `<!--tx-page-body-->` markers is converted to Markdown and appended, as
 * escaped text, to the page's `<template data-page-markdown>`. Working on the
 * built HTML keeps the page render single: the layout never renders its slot
 * twice. Static files only; nothing runs at request time.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { htmlToMarkdown } from './markdown.ts';

const BODY = /<!--tx-page-body-->([\s\S]*?)<!--\/tx-page-body-->/;
const TEMPLATE = /(<template data-page-markdown=""[^>]*>)([\s\S]*?)(<\/template>)/;

/** Text for a `<template>`: the parser decodes it back for `textContent`. */
export function escapeTemplateText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

export function copyPageIntegration(): AstroIntegration {
  return {
    name: 'texuli-copy-page',
    hooks: {
      'astro:build:done': async ({ dir, pages, logger }) => {
        const out = fileURLToPath(dir);
        let filled = 0;
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
          if (next) filled += 1;
        }
        logger.info(`"Copy page" Markdown written for ${filled} pages.`);
      },
    },
  };
}
