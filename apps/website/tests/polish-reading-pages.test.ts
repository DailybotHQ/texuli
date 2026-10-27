/**
 * T-80 — reading-area polish pins (guides, docs shell, 404).
 *
 * The vitest suite cannot compile .astro templates, so the rows are pinned
 * at their seams: the guide nav module (the outline tree must not drift
 * from the real reading order again), the page sources read as text (the
 * honesty claims), and the trail module the visual breadcrumbs share with
 * the BreadcrumbList JSON-LD.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../src/components/docs/markdown.ts';
import { flattenGuidesNav, GUIDES_SECTIONS } from '../src/components/guides/nav.ts';
import { breadcrumbTrail } from '../src/components/seo/breadcrumbs.ts';

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

  it('has one row per guide and no stale names', () => {
    expect(expected.length).toBeGreaterThanOrEqual(8);
    expect(tree).toEqual(expected);
  });

  it('matches the sidebar sections the shell actually renders', () => {
    const sidebarItems = GUIDES_SECTIONS.flatMap((section) => section.items)
      .filter((item) => item.href !== '/guides/')
      .map((item) => item.href.replace('/guides/', '').replace(/\/$/, ''));
    expect(tree).toEqual(sidebarItems);
  });

  it('keeps why-svelte-kotlin in its sidebar position (second, after getting-started)', () => {
    expect(tree.indexOf('why-svelte-kotlin')).toBe(1);
  });
});

describe('rows 1 and 2 — install tells the published preview truth', () => {
  const source = read('apps/website/src/pages/guides/getting-started/index.astro');
  const install = frontmatterString(source, 'installSnippet');
  const init = frontmatterString(source, 'initSnippet');

  it('names the published dist-tag next, not a future ship date', () => {
    expect(install).toContain(
      'pnpm add texuli@next @texuli/tokens@next @texuli/primitives@next @texuli/core@next'
    );
    expect(install).toContain('dist-tag next');
    expect(source).toContain('there is no stable release yet');
    // The stale promise must not come back.
    expect(source).not.toContain('once they ship');
  });

  it('separates the visitor install from the monorepo/copy path', () => {
    expect(install).not.toContain('monorepo');
    expect(init).toContain('packages/tools/src/cli-init/cli.ts init');
    expect(init).toContain('--theme enterprise-neutral');
    expect(source).toContain('from a checkout of the');
    // The old snippet presented the copy path as the visitor's first command.
    expect(source).not.toContain('pnpm exec texuli init');
  });
});

describe('row 5 — wiring tokens has a real snippet mirroring texuli init', () => {
  const source = read('apps/website/src/pages/guides/getting-started/index.astro');
  const wire = frontmatterString(source, 'wireSnippet');

  it('shows the theme attribute, the marked no-flash bootstrap and the stylesheet import', () => {
    expect(wire).toContain('data-tx-theme="enterprise-neutral"');
    expect(wire).toContain('<!-- texuli:no-flash -->');
    expect(wire).toContain("@import '@texuli/tokens/base.css';");
    expect(wire).toContain("import './texuli.css';");
  });

  it('is rendered through GuideCode with the shell styling it', () => {
    expect(source).toContain('code={wireSnippet}');
  });
});

describe('row 7 — the guides overview speaks to the reader, not the build', () => {
  const source = read('apps/website/src/pages/guides/index.astro');

  it('states the reader-facing guarantees', () => {
    expect(source).toContain('static files');
    expect(source).toContain('no request to another origin');
    expect(source).toContain('working offline');
    // The monorepo build aside is gone.
    expect(source).not.toContain('pnpm build');
  });
});

describe('row 4 — snippets render through the highlighted code region', () => {
  for (const page of [
    'apps/website/src/pages/guides/index.astro',
    'apps/website/src/pages/guides/getting-started/index.astro',
  ]) {
    it(`${page} has no raw pre/code of its own`, () => {
      const source = read(page);
      expect(source).not.toMatch(/<pre/);
    });
  }
});

describe('row 6 — visual breadcrumbs share the BreadcrumbList data', () => {
  const layout = read('apps/website/src/layouts/BaseLayout.astro');

  it('renders the trail in a labelled nav in the reading shell', () => {
    expect(layout).toContain('<nav class="crumbs" aria-label="Breadcrumb" data-docs-crumbs="">');
    // Same gate as the JSON-LD: listed pages only, docs shell only.
    expect(layout).toMatch(/\{\s*docs && crumbs\.length >= 2 && \(/);
    expect(layout).toMatch(
      /const crumbs = breadcrumbTrail\(current\);[\s\S]*?\{crumbs\.length >= 2 && <JsonLd data=\{breadcrumbJsonLd\(crumbs\)\} \/>\}/
    );
  });

  it('marks the current page and hides the separators from the tree', () => {
    expect(layout).toMatch(
      /aria-current=\{\s*index === crumbs\.length - 1 \? 'page' : undefined\s*\}/
    );
    expect(layout).toContain('<span class="crumbs__sep" aria-hidden="true">');
    expect(layout).toContain('href={withBase(base, entry.href)}');
  });

  it('styles with logical properties and tokens only', () => {
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
  });

  it('adds no HTML sink to the layout', () => {
    // Four sanctioned sinks exist today: the no-flash bootstrap, the theme
    // CSS and the two copy-page body markers.
    expect(layout.match(/set:html/g) ?? []).toHaveLength(4);
  });

  it('the trail module returns the nav hierarchy, and nothing for unlisted pages', () => {
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

  it('links home, components, guides, examples, themes and search', () => {
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
  });

  it('never reflects the attempted URL', () => {
    expect(template).not.toContain('Astro.url');
    expect(template).not.toContain('location.');
    expect(template).not.toContain('no-such-page');
  });
});

describe('row 9 — the Markdown twin is explained where it is offered', () => {
  const copyPage = read('apps/website/src/components/docs/CopyPage.astro');
  const markdown = read('apps/website/src/components/docs/markdown.ts');

  it('carries a one-line hint beside the button', () => {
    expect(copyPage).toContain('This page ships a Markdown twin for AI tools.');
    const hint = copyPage.indexOf('copy-page__hint');
    const button = copyPage.indexOf('data-copy-page-button');
    expect(hint).toBeGreaterThan(-1);
    expect(button).toBeGreaterThan(hint);
  });

  it('keeps the hint out of the Markdown twin itself', () => {
    expect(markdown).toContain('copy-page__hint');
    // Behavioral, with the scope attribute the build adds (W11; the full
    // built markup is pinned in markdown-negotiation.test.ts).
    const hint = copyPage.match(/<p class="copy-page__hint">([^<]+)<\/p>/)?.[1] ?? '';
    expect(hint).not.toBe('');
    expect(
      htmlToMarkdown(`<p class="copy-page__hint" data-astro-cid-x>${hint}</p><p>Body.</p>`).trim()
    ).toBe('Body.');
  });

  it('hides the hint on narrow viewports and uses logical spacing', () => {
    expect(copyPage).toMatch(/@media \(max-width: 48rem\)/);
    expect(copyPage).toContain('margin-inline-end: auto');
  });
});

describe('row 11 — the pager stays the pass row it is', () => {
  const pager = read('apps/website/src/components/docs/DocsPager.astro');

  it('keeps rel prev/next and the wrap-anywhere guard for long names', () => {
    expect(pager).toContain('rel="prev"');
    expect(pager).toContain('rel="next"');
    expect(pager).toContain('aria-label="Previous and next pages"');
    expect(pager).toContain('overflow-wrap: anywhere');
  });
});
