/**
 * T-90 (PLAN_006): page-layer fixes from the screen-reader pass recorded in
 * docs/quality/sr-transcripts-site.md. The pass read the accessibility tree
 * of the built site with Playwright `ariaSnapshot()`; these tests pin the three
 * page-layer defects it found, at the source, because the unit environment has
 * no Astro renderer (the same convention as native-hero-status.test.ts).
 *
 * 1. /web-and-native/ rendered the docs-shell demo navigation (a second
 *    "Documentation" landmark listing the docs-shell, slides and editor
 *    pages, with no current page) next to the site's own Primary sidebar,
 *    and the "Documentation menu" disclosure on phones. The page keeps the
 *    docs shell's article chrome but opts out of that demo navigation.
 * 2. The /native/ status ledger ran the status badge straight into its
 *    detail ("Shipped All 15 packages…"), so a screen reader read the status
 *    and the sentence as one run. A visually hidden separator now splits them
 *    ("Shipped: All 15 packages…") without changing the visual design.
 * 3. The build's HTML compression dropped the space before the guide link on
 *    /web-and-native/, so the text read "the guideWhy Svelte and Kotlin".
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const shell = () => read('components', 'docs-shell', 'DocsShell.astro');
const architecture = () => read('pages', 'web-and-native', 'index.astro');
const docsShellPages = ['index.astro', 'getting-started/index.astro', 'navigation/index.astro'];
const nativeStatus = () => read('components', 'sections', 'native', 'NativeHeroStatus.astro');

describe('docs shell: the demo navigation is opt-out per page', () => {
  it('declares a demoNav prop that defaults to on', () => {
    expect(shell()).toMatch(/demoNav\?:\s*boolean/);
    expect(shell()).toMatch(/demoNav\s*=\s*true/);
  });

  it('renders the demo sidebar and its mobile menu only when demoNav is on', () => {
    const source = shell();
    expect(source).toMatch(/\{\s*demoNav\s*&&\s*<DocsMobileNav\b/);
    expect(source).toMatch(/\{\s*demoNav\s*&&\s*<DocsSidebar\b/);
  });

  it('drops the empty sidebar column when the demo navigation is off', () => {
    const source = shell();
    expect(source).toContain("'docs-shell__grid--no-demo-nav'");
    const style = source.match(/<style>([\s\S]*)<\/style>/)?.[1] ?? '';
    expect(style).toMatch(
      /\.docs-shell__grid--no-demo-nav\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/
    );
  });

  it('the architecture page opts out of the docs-shell demo navigation', () => {
    expect(architecture()).toMatch(/<DocsShell\b[^>]*\bdemoNav=\{false\}/);
  });

  it('the docs-shell demo pages keep their navigation', () => {
    for (const page of docsShellPages) {
      const source = read('pages', 'docs-shell', page);
      expect(source, page).toContain('<DocsShell');
      expect(source, page).not.toContain('demoNav={false}');
    }
  });
});

describe('architecture page: reading text stays whole', () => {
  it('keeps the space before the guide link (the build collapsed "guideWhy")', () => {
    // compressHTML drops the newline-plus-indent before an inline element, so
    // the text run read "the guideWhy Svelte and Kotlin" on the page, in its
    // Markdown twin and on a braille display. The space must sit on the line.
    expect(architecture()).toMatch(
      /lives in the guide <a href="\/guides\/why-svelte-kotlin\/">Why Svelte and Kotlin<\/a>/
    );
  });
});

describe('native status ledger: the badge and the detail read as two phrases', () => {
  it('puts a visually hidden separator between the badge and the detail', () => {
    expect(nativeStatus()).toMatch(
      /\{row\.statusLabel\}\s*<\/span>\s*<span class="native-status__sep">:\s*<\/span>\s*<span class="native-status__detail">/
    );
  });

  it('hides the separator visually without removing it from the accessibility tree', () => {
    const style = nativeStatus().match(/<style>([\s\S]*)<\/style>/)?.[1] ?? '';
    const rule = style.match(/\.native-status__sep\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule, 'the separator rule exists').not.toBe('');
    expect(rule).toContain('position: absolute');
    expect(rule).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    expect(nativeStatus()).not.toMatch(/native-status__sep"[^>]*aria-hidden/);
  });
});
