/**
 * The reading surfaces (guides, docs shell, 404), pinned at their seams
 * because the unit environment has no Astro renderer; the rendered pages are
 * covered by tests/e2e/site-*.spec.ts with axe in light and dark:
 * - guide code highlighting never rewrites a snippet, renders text only and
 *   keeps WCAG AA token contrast (T-80);
 * - the guides outline, breadcrumbs, 404 and Markdown twin hint (T-80);
 * - the docs shell's single "On this page" navigation (Final Review P2-3);
 * - the screen-reader pass fixes (T-90, docs/quality/sr-transcripts-site.md);
 * - every guide live island is mounted (regression of 7996bbd7);
 * - the site navigation model (groups, current page, pager) and the
 *   "Copy page" Markdown rendition the build fills into every docs page.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { describe, expect, it } from 'vitest';
import { COMPONENT_PAGES } from '../src/components/component-pages/load-manifests.ts';
import { fillPageMarkdown } from '../src/components/docs/integration.ts';
import { htmlToMarkdown } from '../src/components/docs/markdown.ts';
import {
  isDocsPath,
  navSections,
  pagerFor,
  SITE_NAV_GROUPS,
  SITE_NAV_ORDER,
} from '../src/components/foundation/nav-data.ts';
import {
  type GuideLanguage,
  type GuideToken,
  highlightGuideCode,
} from '../src/components/guides/highlight.ts';
import { flattenGuidesNav, GUIDES_SECTIONS } from '../src/components/guides/nav.ts';
import { PRIMITIVES } from '../src/components/primitives-page/primitives.ts';
import { breadcrumbTrail } from '../src/components/seo/breadcrumbs.ts';

describe('guide code highlighting', () => {
  /**
   * T-80 row 4 — build-time highlighting for guide snippets.
   *
   * The scanner (`highlight.ts`) is the safety-critical half: it may only tag
   * slices of the input, never rewrite them, so the component can render each
   * token as template text with no HTML sink. The styling half is pinned by
   * computing WCAG 2.x contrast of every token color against the real
   * compiled code background of the site theme, in light and dark.
   */

  const textOf = (tokens: readonly GuideToken[]): string =>
    tokens.map((token) => token.text).join('');

  /** The install snippet shape (bash): comments, a command, package names. */
  const INSTALL = `# Texuli is in development: every package ships as 0.5.0, a pre-1.0 release — 1.0.0 will be the first stable release.
pnpm add texuli @texuli/tokens @texuli/primitives @texuli/core`;

  /** The imports shape (TypeScript): keywords and strings. */
  const IMPORTS = `import { Button } from 'texuli/button';
import { createRovingFocus } from '@texuli/core/roving';

// Avoid — root barrels pull unrelated code
// import { Button } from 'texuli';`;

  /** The CSS shape: a multi-line block comment and at-rules. */
  const LAYERS = `/* Declare once, first — then import Texuli base + components.
   Use hyphenated host layer names (site-base, site-overrides). */
@layer site-base, tx.base, tx.components, site-overrides;

@layer site-base {
  a { color: var(--tx-link); }
}`;

  /** The markup shape: elements, attributes and both comment styles. */
  const MARKUP = `<!-- index.html — the theme attribute selects the theme -->
<html lang="en" data-tx-theme="enterprise-neutral" data-tx-mode="light">
  <head>
    <!-- texuli:no-flash -->
    <script>/* inlined first */</script>
    <!-- /texuli:no-flash -->
  </head>
</html>`;

  /** The outline shape: a plain text tree, nothing highlighted. */
  const TREE = `guides/
  getting-started/   install the published preview
  why-svelte-kotlin/ web and native, one contract`;

  const kindsOf = (tokens: readonly GuideToken[]): string =>
    tokens
      .filter((token) => token.kind !== 'plain')
      .map((token) => `${token.kind}:${token.text.replace(/\n/g, '\\n')}`)
      .join(' | ');

  describe('highlightGuideCode never rewrites the snippet', () => {
    const fixtures: Array<[string, GuideLanguage | undefined]> = [
      [INSTALL, undefined],
      [IMPORTS, undefined],
      [LAYERS, undefined],
      [MARKUP, undefined],
      [TREE, undefined],
      [INSTALL, 'bash'],
      [LAYERS, 'css'],
      [MARKUP, 'html'],
      // Hostile shapes: the scanner must pass them through untouched.
      [`<script>alert("x")</script>`, 'html'],
      [`const s = "not // a comment";`, 'ts'],
      ['# not a comment in ts', 'ts'],
      [`pnpm add pkg # trailing comment`, 'bash'],
      ['a && b || c', 'bash'],
      ['unclosed "string stays whole', 'ts'],
      ['<!-- unclosed comment', 'html'],
    ];

    it('never rewrites the snippet: round-trips and exact slices only', () => {
      for (const [code, lang] of fixtures) {
        expect(textOf(highlightGuideCode(code, lang ?? 'auto')), `${code} (${lang})`).toBe(code);
      }
      // only produces tokens whose text is an exact slice of the input
      {
        const code = `${INSTALL}\n---\n${MARKUP}`;
        const tokens = highlightGuideCode(code);
        for (const token of tokens) {
          expect(code.includes(token.text)).toBe(true);
          // No token invents markup: every text is copied source, never HTML.
          expect(token.text).not.toMatch(/<span|<code|&lt;/);
        }
      }
    });
  });

  describe('highlightGuideCode tags the expected shapes', () => {
    it('tags comments, keywords, strings, tags and flags in each snippet shape', () => {
      // the install snippet: hash comment, command keyword, plain package names
      {
        const kinds = kindsOf(highlightGuideCode(INSTALL));
        expect(kinds).toContain('comment:# Texuli is in development');
        expect(kinds).toContain('keyword:pnpm');
        expect(kinds).toContain('keyword:texuli');
        // The bare command name is the keyword; scoped package names stay plain.
        expect(kinds).not.toContain('keyword:@texuli/tokens');
        expect(kinds).not.toContain('keyword:add');
        expect(kinds).not.toMatch(/string:/);
      }
      // the imports snippet: keywords and strings, strings win over keywords
      {
        const tokens = highlightGuideCode(IMPORTS);
        const kinds = kindsOf(tokens);
        expect(kinds).toContain('keyword:import');
        expect(kinds).toContain('keyword:from');
        expect(kinds).toContain("string:'texuli/button'");
        // The string's content is never keyword-tagged.
        const stringToken = tokens.find((token) => token.text === "'texuli/button'");
        expect(stringToken?.kind).toBe('string');
        expect(kinds).toContain('comment:// Avoid — root barrels pull unrelated code');
      }
      // the css snippet: one multi-line block comment, at-rules, custom property
      {
        const kinds = kindsOf(highlightGuideCode(LAYERS));
        expect(kinds).toContain(
          'comment:/* Declare once, first — then import Texuli base + components.\\n   Use hyphenated host layer names (site-base, site-overrides). */'
        );
        expect(kinds).toContain('keyword:@layer');
        expect(kinds).toContain('keyword:var');
        expect(kinds).toContain('flag:--tx-link');
      }
      // the markup snippet: tags and both comment styles, attributes stay plain
      {
        const kinds = kindsOf(highlightGuideCode(MARKUP));
        expect(kinds).toContain('tag:<html');
        expect(kinds).toContain('tag:</html');
        expect(kinds).toContain('tag:<script');
        expect(kinds).toContain('comment:<!-- texuli:no-flash -->');
        expect(kinds).toContain(
          'comment:<!-- index.html — the theme attribute selects the theme -->'
        );
        expect(kinds).toContain('comment:/* inlined first */');
        expect(kinds).toContain('string:"en"');
        // Attribute names are not words in the keyword list.
        expect(kinds).not.toContain('keyword:data-tx-theme');
      }
      expect(kindsOf(highlightGuideCode(TREE))).toBe('');
      // the auto detector separates the five shapes
      {
        const tagged = (code: string) => kindsOf(highlightGuideCode(code, 'auto'));
        expect(tagged(INSTALL)).toContain('keyword:pnpm');
        expect(tagged(IMPORTS)).toContain("string:'texuli/button'");
        expect(tagged(LAYERS)).toContain('keyword:@layer');
        expect(tagged(MARKUP)).toContain('tag:<html');
        expect(tagged(TREE)).toBe('');
      }
      // shell flags are tagged only after a separator
      {
        const kinds = kindsOf(
          highlightGuideCode('pnpm exec tsx cli.ts init --cwd app --theme x', 'bash')
        );
        expect(kinds).toContain('flag:--cwd');
        expect(kinds).toContain('flag:--theme');
      }
    });
  });

  describe('GuideCode.astro stays a text-only renderer', () => {
    const file = readFileSync(
      resolve('apps/website/src/components/guides/GuideCode.astro'),
      'utf8'
    );
    // Template claims are checked on the template only; the frontmatter comment
    // names the guarantee ("never set:html") in prose.
    const firstFence = file.indexOf('---');
    const source = file.slice(file.indexOf('---', firstFence + 3) + 3);

    it('renders token text as template text with no sink, and collapses colors in forced-colors', () => {
      expect(file).toContain('highlightGuideCode(code, lang)');
      expect(source).toContain('{token.text}');
      expect(source).not.toContain('set:html');
      expect(source).not.toContain('{@html');
      expect(file).not.toContain('innerHTML');
      expect(source).not.toMatch(/<script/);
      for (const kind of ['comment', 'keyword', 'string', 'tag', 'flag']) {
        expect(source).toContain(`.tk-${kind}`);
      }
      expect(source).toMatch(/@media \(forced-colors: active\)/);
    });
  });

  /**
   * WCAG 2.x relative luminance contrast for the token pairs the stylesheet
   * uses. The site theme is loaded through the real token engine; the guide
   * `<pre>` background is `var(--tx-muted, var(--tx-surface))`.
   */
  describe('token colors pass WCAG AA on the code background in light and dark', () => {
    const luminance = (hex: string): number => {
      const value = hex.replace('#', '');
      if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error(`unsupported color: ${hex}`);
      const channels = [0, 2, 4]
        .map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255)
        .map((channel) =>
          channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        );
      const [r = 0, g = 0, b = 0] = channels;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const contrast = (foreground: string, background: string): number => {
      const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a
      );
      return (lighter + 0.05) / (darker + 0.05);
    };

    it('every token kind reaches 4.5:1 on muted in both modes', async () => {
      const theme = await loadLibraryTheme('enterprise-neutral');
      for (const [kind, role] of [
        ['comment', 'mutedForeground'],
        ['keyword', 'primary'],
        ['tag', 'primary'],
        ['string', 'link'],
        ['flag', 'subtleForeground'],
      ] as const) {
        const pick = (mode: 'light' | 'dark'): { background: string; foreground: string } => {
          const palette = theme[mode] as Record<string, { default?: string } | undefined>;
          const background = palette.muted?.default;
          const foreground = palette[role]?.default;
          if (background === undefined || foreground === undefined) {
            throw new Error(`site theme ${mode} lacks muted or ${role}`);
          }
          return { background, foreground };
        };
        const light = pick('light');
        const dark = pick('dark');
        expect(
          contrast(light.foreground, light.background),
          `${kind} light`
        ).toBeGreaterThanOrEqual(4.5);
        expect(contrast(dark.foreground, dark.background), `${kind} dark`).toBeGreaterThanOrEqual(
          4.5
        );
      }
    });
  });
});

describe('reading pages', () => {
  /**
   * T-80 — reading-area polish pins (guides, docs shell, 404).
   *
   * The vitest suite cannot compile .astro templates, so the rows are pinned
   * at their seams: the guide nav module (the outline tree must not drift
   * from the real reading order again), the page sources read as text (the
   * honesty claims), and the trail module the visual breadcrumbs share with
   * the BreadcrumbList JSON-LD.
   */

  const read = (relativePath: string): string => readFileSync(resolve(relativePath), 'utf8');

  const frontmatterString = (source: string, name: string): string => {
    const match = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`).exec(source);
    if (!match?.[1]) throw new Error(`${name} not found in page frontmatter`);
    return match[1];
  };

  describe('row 3 — the guides outline lists every shipped guide, in reading order', () => {
    const indexSource = read('apps/website/src/pages/guides/index.astro');
    const tree = frontmatterString(indexSource, 'treeSnippet')
      .split('\n')
      .slice(1) // drop the `guides/` root line
      .map((line) => (line.trim().split(/\s/)[0] ?? '').replace(/\/$/, ''))
      .filter((name) => name.length > 0);

    const expected = flattenGuidesNav()
      .filter((link) => link.href !== '/guides/')
      .map((link) => link.href.replace('/guides/', '').replace(/\/$/, ''));

    it("lists every shipped guide once, in the sidebar's reading order", () => {
      expect(expected.length).toBeGreaterThanOrEqual(8);
      expect(tree).toEqual(expected);
      // matches the sidebar sections the shell actually renders
      {
        const sidebarItems = GUIDES_SECTIONS.flatMap((section) => section.items)
          .filter((item) => item.href !== '/guides/')
          .map((item) => item.href.replace('/guides/', '').replace(/\/$/, ''));
        expect(tree).toEqual(sidebarItems);
      }
      expect(tree.indexOf('why-svelte-kotlin')).toBe(1);
    });
  });

  describe('row 6 — visual breadcrumbs share the BreadcrumbList data', () => {
    const layout = read('apps/website/src/layouts/BaseLayout.astro');

    it('renders the BreadcrumbList trail in a labelled nav, current page marked, no new sink', () => {
      expect(layout).toContain('<nav class="crumbs" aria-label="Breadcrumb" data-docs-crumbs="">');
      // Same gate as the JSON-LD: listed pages only, docs shell only.
      expect(layout).toMatch(/\{\s*docs && crumbs\.length >= 2 && \(/);
      expect(layout).toMatch(
        /const crumbs = breadcrumbTrail\(current\);[\s\S]*?\{crumbs\.length >= 2 && <JsonLd data=\{breadcrumbJsonLd\(crumbs\)\} \/>\}/
      );
      expect(layout).toMatch(
        /aria-current=\{\s*index === crumbs\.length - 1 \? 'page' : undefined\s*\}/
      );
      expect(layout).toContain('<span class="crumbs__sep" aria-hidden="true">');
      expect(layout).toContain('href={withBase(base, entry.href)}');
      // styles with logical properties and tokens only
      {
        const style = layout.slice(layout.lastIndexOf('<style>'));
        expect(style).toMatch(/\.crumbs/);
        expect(style).toMatch(/margin-block-end/);
        for (const physical of [
          /[^-]margin-left:/,
          /[^-]margin-right:/,
          /[^-]padding-left:/,
          /[^-]padding-right:/,
        ]) {
          expect(physical.test(style)).toBe(false);
        }
      }
      // Four sanctioned sinks exist today: the no-flash bootstrap, the theme
      // CSS and the two copy-page body markers.
      expect(layout.match(/set:html/g) ?? []).toHaveLength(4);
      expect(breadcrumbTrail('/guides/theming/').map((entry) => entry.name)).toEqual([
        'Home',
        'Get started',
        'Theming',
      ]);
      expect(breadcrumbTrail('/component-pages/button/').map((entry) => entry.name)).toEqual([
        'Home',
        'Components',
        'Button',
      ]);
      expect(breadcrumbTrail('/')).toEqual([]);
      expect(breadcrumbTrail('/no-such-page/')).toEqual([]);
    });
  });

  describe("row 8 — the 404 offers the site's best recovery tools", () => {
    const file = read('apps/website/src/components/seo/NotFound.astro');
    const template = file.slice(file.indexOf('---', file.indexOf('---') + 3) + 3);

    it('offers recovery links and never reflects the attempted URL', () => {
      for (const path of [
        '/',
        '/component-pages/',
        '/guides/',
        '/examples/',
        '/gallery-themes/',
        '/search/',
      ]) {
        expect(file).toContain(`withBase(base, '${path}')`);
      }
      expect(template).not.toContain('Astro.url');
      expect(template).not.toContain('location.');
      expect(template).not.toContain('no-such-page');
    });
  });

  describe('row 9 — the Markdown twin is explained where it is offered', () => {
    const copyPage = read('apps/website/src/components/docs/CopyPage.astro');
    const markdown = read('apps/website/src/components/docs/markdown.ts');

    it('keeps the hint out of the Markdown twin itself', () => {
      expect(markdown).toContain('copy-page__hint');
      // Behavioral, with the scope attribute the build adds (W11; the full
      // built markup is pinned in edge-middleware.test.ts).
      const hint = copyPage.match(/<p class="copy-page__hint">([^<]+)<\/p>/)?.[1] ?? '';
      expect(hint).not.toBe('');
      expect(
        htmlToMarkdown(`<p class="copy-page__hint" data-astro-cid-x>${hint}</p><p>Body.</p>`).trim()
      ).toBe('Body.');
    });
  });
});

describe('docs shell table of contents (P2-3)', () => {
  /**
   * PLAN_006 Final Review P2-3: the docs shell's "On this page" navigation.
   *
   * The base `.docs-shell__toc { display: none }` rule came after the
   * `@media (min-width: 64rem)` rule that shows it, so at equal specificity
   * the later rule won and the desktop TOC never appeared. On /web-and-native/
   * (a docs-layout page) that left no TOC at all between 64rem and 80rem, and
   * fixing the order naively would show two "On this page" navigations at
   * 80rem and up, where BaseLayout's PageToc owns the side column.
   *
   * The unit environment has no Astro renderer, so these tests resolve the
   * cascade from the component source (the docs-reading.test.ts convention):
   * a small evaluator applies the top-level rules and `min-width`/`max-width`
   * media blocks in source order with class-count specificity.
   *
   * The contract, per viewport width:
   * - below 64rem: the inline (mobile) shell TOC only;
   * - 64rem up to 80rem: the shell's side-column TOC only;
   * - 80rem and up: the shell TOC on pages without PageToc (the /docs-shell/*
   *   demo), and BaseLayout's PageToc alone on docs-layout pages
   *   (`isDocsPath`, e.g. /web-and-native/), where the shell yields.
   */

  const HERE = dirname(fileURLToPath(import.meta.url));
  const SRC = resolve(HERE, '../src');
  const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

  const shell = () => read('components', 'docs-shell', 'DocsShell.astro');
  const pageToc = () => read('components', 'docs', 'PageToc.astro');
  const baseLayout = () => read('layouts', 'BaseLayout.astro');

  interface Rule {
    selector: string;
    decls: Record<string, string>;
    min: number;
    max: number;
    order: number;
  }

  /** Parse the component's <style> into flat rules with their width range (rem). */
  function parseRules(source: string): Rule[] {
    const css = (source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '').replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    );
    const rules: Rule[] = [];
    let order = 0;
    const pushBlock = (body: string, min: number, max: number) => {
      for (const match of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const decls: Record<string, string> = {};
        for (const decl of match[2].split(';')) {
          const [prop, ...value] = decl.split(':');
          if (prop?.trim() && value.length) decls[prop.trim()] = value.join(':').trim();
        }
        for (const selector of match[1].split(',')) {
          rules.push({ selector: selector.trim(), decls, min, max, order: order++ });
        }
      }
    };
    let rest = css;
    for (;;) {
      const at = rest.search(/@media\b/);
      if (at === -1) {
        pushBlock(rest, 0, Number.POSITIVE_INFINITY);
        break;
      }
      pushBlock(rest.slice(0, at), 0, Number.POSITIVE_INFINITY);
      const open = rest.indexOf('{', at);
      const query = rest.slice(at, open);
      let depth = 1;
      let index = open + 1;
      while (depth > 0) {
        if (rest[index] === '{') depth += 1;
        if (rest[index] === '}') depth -= 1;
        index += 1;
      }
      const min = Number(query.match(/min-width:\s*([\d.]+)rem/)?.[1] ?? 0);
      const max = Number(query.match(/max-width:\s*([\d.]+)rem/)?.[1] ?? Number.POSITIVE_INFINITY);
      // Only width queries take part; any other query (forced colors) is skipped.
      if (/width/.test(query)) pushBlock(rest.slice(open + 1, index - 1), min, max);
      rest = rest.slice(index);
    }
    return rules;
  }

  /**
   * The winning value of `prop` for an element with `own` classes inside
   * ancestors carrying `ancestors` classes, at viewport `width` rem.
   * Selectors are class compounds joined by descendant combinators.
   */
  function resolveProp(
    rules: Rule[],
    prop: string,
    own: string[],
    ancestors: string[],
    width: number
  ): string | undefined {
    let best: { value: string; specificity: number; order: number } | undefined;
    for (const rule of rules) {
      if (!(prop in rule.decls) || width < rule.min || width > rule.max) continue;
      const parts = rule.selector.split(/\s+/).map((part) => part.split('.').filter(Boolean));
      const last = parts.at(-1) ?? [];
      if (!last.length || !last.every((name) => own.includes(name))) continue;
      if (
        !parts.slice(0, -1).every((compound) => compound.every((name) => ancestors.includes(name)))
      )
        continue;
      const specificity = parts.flat().length;
      if (
        !best ||
        specificity > best.specificity ||
        (specificity === best.specificity && rule.order > best.order)
      ) {
        best = { value: rule.decls[prop], specificity, order: rule.order };
      }
    }
    return best?.value;
  }

  const rules = () => parseRules(shell());
  const GRID = 'docs-shell__grid';
  const NO_DEMO = 'docs-shell__grid--no-demo-nav';
  const PAGE_TOC = 'docs-shell__grid--page-toc';

  const desktopToc = (gridClasses: string[], width: number) =>
    resolveProp(rules(), 'display', ['docs-shell__toc'], gridClasses, width) ?? 'block';
  const mobileToc = (gridClasses: string[], width: number) =>
    resolveProp(rules(), 'display', ['docs-article__toc-mobile'], gridClasses, width) ?? 'block';
  const columns = (gridClasses: string[], width: number) =>
    resolveProp(rules(), 'grid-template-columns', gridClasses, [], width) ?? 'none';

  /** How many "On this page" navigations show at a width, PageToc included. */
  function visibleTocs(gridClasses: string[], width: number, layoutPageToc: boolean): number {
    const pageTocShows = layoutPageToc && width >= 80;
    return (
      Number(desktopToc(gridClasses, width) !== 'none') +
      Number(mobileToc(gridClasses, width) !== 'none') +
      Number(pageTocShows)
    );
  }

  describe('docs shell TOC: the desktop column actually shows', () => {
    it('shows the side TOC from 64rem (demo and docs-layout pages) and the inline TOC below 64rem only', () => {
      expect(desktopToc([GRID], 68.75)).toBe('block');
      expect(desktopToc([GRID], 87.5)).toBe('block');
      expect(desktopToc([GRID], 40)).toBe('none');
      expect(desktopToc([GRID, NO_DEMO, PAGE_TOC], 68.75)).toBe('block');
      expect(mobileToc([GRID], 40)).toBe('block');
      expect(mobileToc([GRID], 68.75)).toBe('none');
    });
  });

  describe('docs shell TOC: never two "On this page" navigations at one width', () => {
    it('yields to PageToc exactly at 80rem and exactly when BaseLayout renders it', () => {
      for (const width of [40, 63.9, 64, 68.75, 79.9, 80, 87.5, 120]) {
        expect(visibleTocs([GRID], width, false), `/docs-shell/* at ${width}rem`).toBe(1);
        expect(
          visibleTocs([GRID, NO_DEMO, PAGE_TOC], width, true),
          `/web-and-native/ at ${width}rem`
        ).toBe(1);
      }
      expect(pageToc()).toContain("matchMedia('(min-width: 80rem)')");
      expect(pageToc()).toMatch(/@media \(min-width: 80rem\)\s*\{\s*\.page-toc:not\(\[hidden\]\)/);
      expect(desktopToc([GRID, NO_DEMO, PAGE_TOC], 80)).toBe('none');
      // marks the grid with the PageToc modifier exactly when BaseLayout renders PageToc
      {
        expect(baseLayout()).toMatch(/const docs = !landing && !noindex && isDocsPath\(current\)/);
        expect(baseLayout()).toMatch(/\{docs && <PageToc \/>\}/);
        const source = shell();
        expect(source).toMatch(/import \{ isDocsPath \} from '\.\.\/foundation\/nav-data\.ts'/);
        expect(source).toMatch(/const layoutPageToc = isDocsPath\(current\)/);
        expect(source).toContain("layoutPageToc && 'docs-shell__grid--page-toc'");
      }
    });
  });

  describe('docs shell TOC: the grid columns', () => {
    it('uses sidebar, article and TOC columns as the navigation and PageToc require', () => {
      expect(columns([GRID], 68.75)).toBe('14rem minmax(0, 1fr) 13rem');
      expect(columns([GRID], 87.5)).toBe('14rem minmax(0, 1fr) 13rem');
      expect(columns([GRID, NO_DEMO], 68.75)).toBe('minmax(0, 1fr) 13rem');
      expect(columns([GRID, NO_DEMO, PAGE_TOC], 68.75)).toBe('minmax(0, 1fr) 13rem');
      expect(columns([GRID, NO_DEMO, PAGE_TOC], 87.5)).toBe('minmax(0, 1fr)');
      expect(columns([GRID, PAGE_TOC], 87.5)).toBe('14rem minmax(0, 1fr)');
    });
  });
});

describe('screen-reader pass fixes (T-90)', () => {
  /**
   * T-90 (PLAN_006): page-layer fixes from the screen-reader pass recorded in
   * docs/quality/sr-transcripts-site.md. The pass read the accessibility tree
   * of the built site with Playwright `ariaSnapshot()`; these tests pin the three
   * page-layer defects it found, at the source, because the unit environment has
   * no Astro renderer (the same convention as section-contracts.test.ts).
   *
   * 1. /web-and-native/ rendered the docs-shell demo navigation (a second
   *    "Documentation" landmark listing the docs-shell, slides and editor
   *    pages, with no current page) next to the site's own Primary sidebar,
   *    and the "Documentation menu" disclosure on phones. The page keeps the
   *    docs shell's article chrome but opts out of that demo navigation.
   * 2. The /native/ status ledger ran the status badge straight into its
   *    detail ("Shipped All 18 packages…"), so a screen reader read the status
   *    and the sentence as one run. A visually hidden separator now splits them
   *    ("Shipped: All 18 packages…") without changing the visual design.
   * 3. The build's HTML compression dropped the space before the guide link on
   *    /web-and-native/, so the text read "the guideWhy Svelte and Kotlin".
   */

  const HERE = dirname(fileURLToPath(import.meta.url));
  const SRC = resolve(HERE, '../src');
  const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

  const shell = () => read('components', 'docs-shell', 'DocsShell.astro');
  const architecture = () => read('pages', 'web-and-native', 'index.astro');
  const docsShellPages = ['index.astro', 'getting-started/index.astro', 'navigation/index.astro'];
  const nativeStatus = () => read('components', 'sections', 'native', 'NativeHeroStatus.astro');

  describe('docs shell: the demo navigation is opt-out per page', () => {
    it('the demo navigation is on by default and off on the architecture page, column included', () => {
      expect(shell()).toMatch(/demoNav\?:\s*boolean/);
      expect(shell()).toMatch(/demoNav\s*=\s*true/);
      // renders the demo sidebar and its mobile menu only when demoNav is on
      {
        const source = shell();
        expect(source).toMatch(/\{\s*demoNav\s*&&\s*<DocsMobileNav\b/);
        expect(source).toMatch(/\{\s*demoNav\s*&&\s*<DocsSidebar\b/);
      }
      // drops the empty sidebar column when the demo navigation is off
      {
        const source = shell();
        expect(source).toContain("'docs-shell__grid--no-demo-nav'");
        const style = source.match(/<style>([\s\S]*)<\/style>/)?.[1] ?? '';
        expect(style).toMatch(
          /\.docs-shell__grid--no-demo-nav\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/
        );
      }
      expect(architecture()).toMatch(/<DocsShell\b[^>]*\bdemoNav=\{false\}/);
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
      // hides the separator visually without removing it from the accessibility tree
      {
        const style = nativeStatus().match(/<style>([\s\S]*)<\/style>/)?.[1] ?? '';
        const rule = style.match(/\.native-status__sep\s*\{([^}]*)\}/)?.[1] ?? '';
        expect(rule, 'the separator rule exists').not.toBe('');
        expect(rule).toContain('position: absolute');
        expect(rule).toMatch(/clip-path:\s*inset\(50%\)/);
        expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden/);
        expect(nativeStatus()).not.toMatch(/native-status__sep"[^>]*aria-hidden/);
      }
    });
  });
});

describe('guide live islands', () => {
  /**
   * Every guide's live snippet is mounted (docs/site-guides.md: each guide
   * includes a live Texuli snippet that actually runs). Regression: 7996bbd7
   * rewrote getting-started and dropped `<GettingStartedLive client:load />`,
   * leaving the island orphaned and the page with nothing live.
   */

  const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
  const guidesDir = join(srcDir, 'components/guides');
  const pagesDir = join(srcDir, 'pages/guides');

  const liveIslands = readdirSync(guidesDir)
    .filter((file) => file.endsWith('Live.svelte'))
    .map((file) => file.replace(/\.svelte$/, ''))
    .sort();

  const pages = readdirSync(pagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      slug: entry.name,
      source: readFileSync(join(pagesDir, entry.name, 'index.astro'), 'utf8'),
    }));

  describe('guide live islands', () => {
    it('every live island is imported and hydrated by exactly one guide page', () => {
      expect(liveIslands).toContain('GettingStartedLive');
      expect(liveIslands.length).toBeGreaterThanOrEqual(7);
      for (const island of liveIslands) {
        const mounting = pages.filter(
          ({ source }) =>
            source.includes(
              `import ${island} from '../../../components/guides/${island}.svelte'`
            ) && new RegExp(`<${island}\\s[^>]*client:(load|visible|idle)`).test(source)
        );
        expect(
          mounting.map((page) => page.slug),
          island
        ).toHaveLength(1);
      }
    });

    it('getting-started mounts its live example under a heading in the table of contents', () => {
      const page = pages.find(({ slug }) => slug === 'getting-started');
      expect(page?.source).toContain(
        "{ id: 'live-example', label: 'Live example', level: 2 as const }"
      );
      expect(page?.source).toContain('<h2 id="live-example">Live example</h2>');
    });
  });
});

describe('site navigation model', () => {
  const BUTTON = '/component-pages/button/';

  it('groups come from site.ts: guides in reading order, the platform pair, every component and primitive', () => {
    expect(SITE_NAV_GROUPS.map((group) => group.label)).toEqual([
      'Get started',
      'Platform',
      'Components',
      'Primitives',
      'Themes',
      'Agents',
      'Project',
    ]);
    const guides = GUIDES_SECTIONS.flatMap((section) => section.items).map((item) => item.href);
    expect(SITE_NAV_GROUPS[0]?.links.map((link) => link.href)).toEqual([...guides, '/skill/']);
    const platform = SITE_NAV_GROUPS.find((group) => group.id === 'platform');
    expect(platform?.links.map((link) => link.href)).toEqual(['/web-and-native/', '/native/']);
    // The home is a landing outside the docs navigation.
    expect(SITE_NAV_ORDER.some((link) => link.href === '/')).toBe(false);
    expect(SITE_NAV_ORDER.some((link) => link.href.startsWith('/migration'))).toBe(false);

    const hrefs = new Set(SITE_NAV_ORDER.map((link) => link.href));
    for (const entry of COMPONENT_PAGES) expect(hrefs).toContain(`/component-pages/${entry.id}/`);
    for (const doc of PRIMITIVES) expect(hrefs).toContain(`/primitives-page/${doc.id}/`);
    // Catalog pages nest one level per family, sorted, each listed once.
    const families =
      SITE_NAV_GROUPS.find((group) => group.id === 'components')?.links.filter(
        (link) => link.children
      ) ?? [];
    for (const family of families) {
      const labels = (family.children ?? []).map((child) => child.label);
      expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, 'en')));
    }
    const labels = families.flatMap((family) => (family.children ?? []).map((c) => c.label));
    expect(new Set(labels).size).toBe(COMPONENT_PAGES.length);
  });

  it('marks the current page and section, pages in sidebar order, and tells docs pages apart', () => {
    const button = navSections('', BUTTON).flatMap((section) => section.items);
    const family = button.find(
      (item) => item.current === 'section' && item.children?.some((child) => child.current)
    );
    expect(family?.children?.filter((child) => child.current)).toEqual([
      { label: 'Button', href: BUTTON, current: 'page' },
    ]);
    // A page without its own link marks its nearest listed ancestor.
    const dashboard = navSections('/base', '/showcase/dashboard/').flatMap((s) => s.items);
    expect(dashboard.filter((item) => item.current)).toEqual([
      { label: 'Showcase', href: '/base/showcase/', current: 'section' },
    ]);
    const index = SITE_NAV_ORDER.findIndex((link) => link.href === BUTTON);
    expect(pagerFor(BUTTON)).toEqual({
      previous: SITE_NAV_ORDER[index - 1],
      next: SITE_NAV_ORDER[index + 1],
    });
    expect(pagerFor('/guides/')).toEqual({ next: SITE_NAV_ORDER[1] });
    expect(pagerFor('/')).toEqual({});
    expect(pagerFor('/not-listed/')).toEqual({});
    expect(isDocsPath(BUTTON)).toBe(true);
    expect(isDocsPath('/guides/install/')).toBe(true);
    expect(isDocsPath('/gallery-components/')).toBe(false);
    expect(isDocsPath('/')).toBe(false);
  });

  it('"Copy page" Markdown keeps content, drops controls and hidden text, and fills only the body', () => {
    const markdown = htmlToMarkdown(`
      <h2 id="a">Usage &amp; notes</h2>
      <p>Read the <a href="/guides/">guides</a> and use <code>texuli add</code>.</p>
      <p>Render <code>&lt;Button&gt;</code> for an &lt;a&gt; link.</p>
      <pre><code>pnpm add texuli</code></pre>
      <table><tr><th>Prop</th><th>Type</th></tr><tr><td>size</td><td>sm | md</td></tr></table>
      <button>Copy page</button><script>alert(1)</script>
      <div aria-hidden="true">decoration</div><p hidden>secret</p>`);
    expect(markdown).toContain('## Usage & notes');
    expect(markdown).toContain('Read the [guides](/guides/) and use `texuli add`.');
    expect(markdown).toContain('```\npnpm add texuli\n```');
    // Escaped text survives as text: it is never mistaken for a tag.
    expect(markdown).toContain('Render `<Button>` for an <a> link.');
    expect(markdown).toContain('| Prop | Type |');
    for (const dropped of ['Copy page', 'alert(1)', 'decoration', 'secret'])
      expect(markdown).not.toContain(dropped);

    const page = `<main><template data-page-markdown="" data-x>Head\n</template><!--tx-page-body--><h2>A &lt;b&gt; tag</h2><p>x</p><!--/tx-page-body--><nav>Pager</nav></main>`;
    const filled = fillPageMarkdown(page) ?? '';
    expect(filled).toContain('<template data-page-markdown="" data-x>Head\n## A &lt;b&gt; tag');
    expect(filled).not.toContain('tx-page-body');
    expect(filled).not.toMatch(/<template[^>]*>[^<]*Pager/);
    expect(fillPageMarkdown('<main><p>No template</p></main>')).toBeNull();
  });
});
