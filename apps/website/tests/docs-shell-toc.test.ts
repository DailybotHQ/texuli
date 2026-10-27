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
 * cascade from the component source (the a11y-sr-pass.test.ts convention):
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
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
    if (!parts.slice(0, -1).every((compound) => compound.every((name) => ancestors.includes(name))))
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
  it('shows the side-column TOC from 64rem on the /docs-shell/* demo pages', () => {
    expect(desktopToc([GRID], 68.75)).toBe('block');
    expect(desktopToc([GRID], 87.5)).toBe('block');
    expect(desktopToc([GRID], 40)).toBe('none');
  });

  it('shows the side-column TOC between 64rem and 80rem on a docs-layout page', () => {
    expect(desktopToc([GRID, NO_DEMO, PAGE_TOC], 68.75)).toBe('block');
  });

  it('keeps the inline TOC below 64rem only', () => {
    expect(mobileToc([GRID], 40)).toBe('block');
    expect(mobileToc([GRID], 68.75)).toBe('none');
  });
});

describe('docs shell TOC: never two "On this page" navigations at one width', () => {
  for (const width of [40, 63.9, 64, 68.75, 79.9, 80, 87.5, 120]) {
    it(`/docs-shell/* (no PageToc) shows exactly one at ${width}rem`, () => {
      expect(visibleTocs([GRID], width, false)).toBe(1);
    });
    it(`/web-and-native/ (PageToc at 80rem+) shows exactly one at ${width}rem`, () => {
      expect(visibleTocs([GRID, NO_DEMO, PAGE_TOC], width, true)).toBe(1);
    });
  }

  it('yields the side column at the PageToc breakpoint, which is 80rem', () => {
    expect(pageToc()).toContain("matchMedia('(min-width: 80rem)')");
    expect(pageToc()).toMatch(/@media \(min-width: 80rem\)\s*\{\s*\.page-toc:not\(\[hidden\]\)/);
    expect(desktopToc([GRID, NO_DEMO, PAGE_TOC], 80)).toBe('none');
  });

  it('marks the grid with the PageToc modifier exactly when BaseLayout renders PageToc', () => {
    expect(baseLayout()).toMatch(/const docs = !landing && !noindex && isDocsPath\(current\)/);
    expect(baseLayout()).toMatch(/\{docs && <PageToc \/>\}/);
    const source = shell();
    expect(source).toMatch(/import \{ isDocsPath \} from '\.\.\/foundation\/nav-data\.ts'/);
    expect(source).toMatch(/const layoutPageToc = isDocsPath\(current\)/);
    expect(source).toContain("layoutPageToc && 'docs-shell__grid--page-toc'");
  });
});

describe('docs shell TOC: the grid columns', () => {
  it('uses sidebar, article and TOC columns from 64rem with the demo navigation', () => {
    expect(columns([GRID], 68.75)).toBe('14rem minmax(0, 1fr) 13rem');
    expect(columns([GRID], 87.5)).toBe('14rem minmax(0, 1fr) 13rem');
  });

  it('uses two columns (article, shell TOC) without the demo navigation', () => {
    expect(columns([GRID, NO_DEMO], 68.75)).toBe('minmax(0, 1fr) 13rem');
    expect(columns([GRID, NO_DEMO, PAGE_TOC], 68.75)).toBe('minmax(0, 1fr) 13rem');
  });

  it('drops the empty TOC column once PageToc takes over at 80rem', () => {
    expect(columns([GRID, NO_DEMO, PAGE_TOC], 87.5)).toBe('minmax(0, 1fr)');
    expect(columns([GRID, PAGE_TOC], 87.5)).toBe('14rem minmax(0, 1fr)');
  });
});
