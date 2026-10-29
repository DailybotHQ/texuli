/**
 * /output-page/ (PLAN_010 T-site-080): honest status (unreleased, coming
 * in 0.8.0; English the only shipped language, translations planned),
 * fictional data, no HTML sink anywhere in the site's output code (the
 * email is shown as text or as a static file in a sandboxed frame, never
 * through srcdoc or innerHTML), lazy islands, the drafts rendering and
 * refusing as the page says, the email preview route escaping by
 * construction with a noindex meta, the demo catalog valid and limited to
 * real message ids, and the hostile catalog losing exactly its bad
 * entries.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCatalog } from '@texuli/core/i18n';
import { PRIMITIVES_MESSAGES_EN } from '@texuli/primitives';
import { renderEmail } from '@texuli/tools/email';
import { blueprintToDocument, renderBlueprintPdf } from '@texuli/tools/print';
import { TEXULI_MESSAGES_EN } from 'texuli';
import { describe, expect, it } from 'vitest';
import {
  EMAIL_OPTIONS,
  OUTPUT_DRAFTS,
  RAW_MARKUP_DIGEST,
  SCRIPT_LINK_DIGEST,
  WEEKLY_DIGEST,
} from '../src/components/output-site/drafts.ts';
import spanish from '../src/components/output-site/locales/es.ts';
import {
  HOSTILE_CATALOG_JSON,
  OUTPUT_DOCS,
  OUTPUT_RELEASE,
  OUTPUT_SECTIONS,
  OUTPUT_STATUS,
} from '../src/components/output-site/page.ts';
import { GET } from '../src/pages/output-page/preview/index.html.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/output-page/index.astro');
const ISLANDS = ['EmailFrame', 'EmailLab', 'I18nDemo', 'PrintDemo'];
const SOURCES = [
  ...ISLANDS.map((name) => `components/output-site/${name}.svelte`),
  'components/output-site/drafts.ts',
  'components/output-site/locales/es.ts',
  'components/output-site/page.ts',
  'pages/output-page/preview/index.html.ts',
  'pages/output-page/index.astro',
].map((path) => [path, read(path)] as const);

describe('output page: copy and safety', () => {
  it('says the targets are unreleased and coming in 0.8.0, and that translations are planned', () => {
    expect(OUTPUT_RELEASE).toBe('0.8.0');
    expect(OUTPUT_STATUS).toContain('not in the published 0.7.0');
    const copy = PAGE.replace(/\s+/g, ' ');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the page source holds this template literally.
    expect(copy).toContain('unreleased · coming in ${OUTPUT_RELEASE}');
    expect(copy).toContain('they are not in the <code>0.7.0</code> published to npm');
    const i18n = OUTPUT_SECTIONS.find((entry) => entry.id === 'i18n')?.summary ?? '';
    expect(i18n).toContain('English is the only language Texuli ships');
    expect(i18n).toContain('translations beyond English are planned');
    expect(read('components/output-site/locales/es.ts')).toContain('Texuli ships English only');
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/production[- ]ready|is released|available on npm/i);
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML|srcdoc|insertAdjacentHTML/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
    }
    // The frame is fully sandboxed, mounted on request, and points at the static preview.
    const frame = read('components/output-site/EmailFrame.svelte');
    expect(frame).toMatch(/<iframe[^>]*sandbox=""/);
    expect(frame).not.toMatch(/allow-scripts|allow-same-origin|allow-top-navigation/);
    expect(PAGE).toContain(
      "previewHref = withBase(import.meta.env.BASE_URL, '/output-page/preview/')"
    );
  });

  it('mounts every island with client:visible and loads the heavy modules lazily', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name).sort()).toEqual(ISLANDS);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    const heavy = /^import\s+(?!type\b)[^;]*from\s+'@texuli\/(player|tools\/email|tools\/print)'/m;
    for (const name of ISLANDS) {
      expect(read(`components/output-site/${name}.svelte`), name).not.toMatch(heavy);
    }
  });

  it('gives every section an anchor and a unique id, and points at docs that exist', () => {
    const ids = OUTPUT_SECTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PAGE).toContain(`id="${id}"`);
    expect(PAGE).not.toMatch(/<h1[\s>]/);
    for (const doc of OUTPUT_DOCS) expect(existsSync(resolve(doc.path)), doc.path).toBe(true);
  });
});

describe('output page: data', () => {
  it('renders the digest with one warning and refuses the two hostile drafts', () => {
    expect(OUTPUT_DRAFTS.map((draft) => draft.id)).toEqual(['digest', 'script-link', 'raw-markup']);
    const digest = renderEmail(WEEKLY_DIGEST, EMAIL_OPTIONS);
    expect(digest.ok).toBe(true);
    expect(digest.diagnostics.map((entry) => entry.code)).toEqual(['email-unsupported']);
    expect(digest.html).not.toMatch(/<script|<style|<iframe|\son[a-z]+=/i);
    expect(digest.text).toContain('Open the dashboard: https://example.com/dashboard');
    for (const draft of [SCRIPT_LINK_DIGEST, RAW_MARKUP_DIGEST]) {
      const refused = renderEmail(draft, EMAIL_OPTIONS);
      expect(refused.ok).toBe(false);
      expect(refused.html).toBe('');
    }
  });

  it('serves the preview as the package wrote it, plus a noindex meta', async () => {
    const response = await GET({} as never);
    const html = await response.text();
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(
      html.startsWith(
        '<!doctype html><html lang="en" dir="ltr"><head><meta name="robots" content="noindex">'
      )
    ).toBe(true);
    expect(html.replace('<meta name="robots" content="noindex">', '')).toBe(
      renderEmail(WEEKLY_DIGEST, EMAIL_OPTIONS).html
    );
  });

  it('maps the digest to a document and a one-page PDF with no JavaScript', async () => {
    const mapped = blueprintToDocument(WEEKLY_DIGEST, { title: 'Harbor weekly digest' });
    expect(mapped.ok).toBe(true);
    const pdf = await renderBlueprintPdf(WEEKLY_DIGEST, {
      page: { size: 'a4', orientation: 'portrait' },
    });
    expect(pdf.ok).toBe(true);
    if (!pdf.ok) return;
    const text = new TextDecoder('latin1').decode(pdf.bytes);
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).not.toMatch(/\/JavaScript|\/JS\b|\/AcroForm|\/EmbeddedFile/);
  });

  it('keeps the demo catalog valid and limited to real ids, and drops the hostile entries', () => {
    const parsed = parseCatalog(spanish);
    expect(parsed.issues).toEqual([]);
    const known = new Set([
      ...Object.keys(TEXULI_MESSAGES_EN.messages),
      ...Object.keys(PRIMITIVES_MESSAGES_EN.messages),
      'demo.files',
    ]);
    for (const id of Object.keys(spanish.messages)) expect(known.has(id), id).toBe(true);
    const hostile = parseCatalog(JSON.parse(HOSTILE_CATALOG_JSON));
    expect(Object.keys(hostile.catalog?.messages ?? {}).sort()).toEqual([
      'texuli.dialog.close-label',
      'texuli.rating.label',
    ]);
    expect(hostile.issues).toHaveLength(5);
  });
});
