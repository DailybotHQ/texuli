/**
 * T-79 — core-area polish (PLAN_006 design-punchlist/core.md): the landing,
 * the site header and the site footer.
 *
 * - row 6: the hero proof strip counts come from the same sources the pages
 *   they link to render, and every target is a real route;
 * - row 2: the home title and description name the platform, inside the
 *   SEO audit's length bands;
 * - row 13: the scroll reveal is opt-in motion (reduced-motion gated,
 *   support gated) and moves by transform only;
 * - rows 3, 4, 9, 14: the footer states the release truth without a
 *   version number, and carries the project row (repository, license,
 *   brand) through the URL policy;
 * - row 12: the phone search trigger keeps a 2.5rem target.
 *
 * The vitest suite cannot compile .astro templates, so templates are read
 * as source next to the real data modules.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPONENT_PAGES } from '../src/components/component-pages/load-manifests.ts';
import { buildExampleCatalog } from '../src/components/examples/catalog.ts';
import { PRIMITIVES } from '../src/components/primitives-page/primitives.ts';
import {
  loadHeroProof,
  WEB_HERO_PROOF_LABEL,
} from '../src/components/sections/web/web-hero-content.ts';

function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`repository root not found from ${process.cwd()}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const WEBSITE = resolve(REPO_ROOT, 'apps/website');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');

const hero = read('src/components/sections/web/WebHero.astro');
const home = read('src/pages/index.astro');
const footer = read('src/components/foundation/SiteFooter.astro');
const header = read('src/components/foundation/SiteHeader.astro');

const styleOf = (source: string): string => source.slice(source.lastIndexOf('<style>'));

/** Whether a site route has a page in the source tree. */
function routeExists(href: string): boolean {
  const dir = resolve(WEBSITE, 'src/pages', href.replace(/^\/+|\/+$/g, ''));
  return existsSync(resolve(dir, 'index.astro'));
}

describe('hero proof strip (row 6)', () => {
  it('counts the real catalog, primitives and examples', async () => {
    const proof = await loadHeroProof();
    expect(proof.map((stat) => stat.id)).toEqual(['components', 'primitives', 'examples']);
    const value = (id: string) => proof.find((stat) => stat.id === id)?.value;
    expect(value('components')).toBe(COMPONENT_PAGES.length);
    expect(value('primitives')).toBe(PRIMITIVES.length);
    expect(value('examples')).toBe(buildExampleCatalog().length);
    for (const stat of proof) expect(stat.value).toBeGreaterThan(0);
  });

  it('links every count to the page that lists what it counts', async () => {
    const proof = await loadHeroProof();
    expect(proof.map((stat) => stat.href)).toEqual([
      '/component-pages/',
      '/primitives-page/',
      '/examples/',
    ]);
    for (const stat of proof) expect(routeExists(stat.href), stat.href).toBe(true);
  });

  it('renders as a labelled list of links through the URL policy, no hardcoded numbers', () => {
    expect(WEB_HERO_PROOF_LABEL).toBe('Texuli by the numbers');
    expect(hero).toContain('aria-label={WEB_HERO_PROOF_LABEL}');
    expect(hero).toContain('loadHeroProof()');
    expect(hero).toMatch(/href=\{resolveHref\(stat\.href\)\}/);
    expect(hero).toContain('{stat.value}');
    // The value and label are separate spans: a space keeps the link name
    // "133 catalog components", not "133catalog components".
    expect(hero).toMatch(/\{stat\.value\}<\/span>\{' '\}/);
    expect(hero).not.toMatch(/>\s*\d{2,}\s*</);
  });
});

describe('home metadata (row 2)', () => {
  const title = /const HOME_TITLE = '([^']+)'/.exec(home)?.[1] ?? '';
  const description = (/const HOME_DESCRIPTION =([\s\S]*?);/.exec(home)?.[1] ?? '')
    .split('+')
    .map((part) => part.trim().replace(/^'|'$/g, ''))
    .join('');

  it('claims the platform in the title, inside the audit band with the site suffix', () => {
    expect(title).toBe('One component catalog for web and native');
    const full = `${title} · Texuli`;
    expect(full.length).toBeGreaterThanOrEqual(12);
    expect(full.length).toBeLessThanOrEqual(65);
    expect(home).toContain('title={HOME_TITLE}');
  });

  it('names both runtimes honestly and the agent story, inside the audit band', () => {
    expect(description).toContain('Svelte 5');
    expect(description).toContain('Kotlin Multiplatform renderer in development');
    expect(description).toMatch(/agents/);
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(165);
    expect(home).toContain('description={HOME_DESCRIPTION}');
  });
});

describe('scroll reveal (row 13)', () => {
  const style = styleOf(home);

  it('animates only under prefers-reduced-motion: no-preference and scroll-timeline support', () => {
    const gate = style.indexOf('@media (prefers-reduced-motion: no-preference)');
    const supports = style.indexOf('@supports (animation-timeline: view())');
    const animation = style.indexOf('animation-name:');
    expect(gate).toBeGreaterThan(-1);
    expect(supports).toBeGreaterThan(gate);
    expect(animation).toBeGreaterThan(supports);
    expect(style).toContain('animation-timeline: view()');
    // No full shorthand: the minifier would fold the timeline into it.
    expect(style).not.toMatch(/\banimation:\s/);
    expect(style).toContain('animation-name: landing-rise');
  });

  it('never touches the hero and moves by transform only, never opacity or visibility', () => {
    expect(style).toContain('section + section');
    const keyframes = style.slice(style.indexOf('@keyframes'));
    expect(keyframes).toMatch(/translate:/);
    expect(keyframes).not.toMatch(/opacity|visibility|clip-path/);
  });
});

describe('footer (rows 3, 4, 9, 14)', () => {
  const status = /<p class="site-footer__status"[\s\S]*?<\/p>/.exec(footer)?.[0] ?? '';

  it('states the release truth: npm preview under next, no stable release, native in development', () => {
    expect(status).not.toBe('');
    expect(footer).not.toContain('not released yet');
    expect(status).toMatch(/Preview packages are on npm/);
    expect(status).toContain('<code>next</code>');
    expect(status).toMatch(/no stable release yet/);
    expect(status).toMatch(/native renderer is in development/);
    expect(status).toContain('Dailybot, Inc.');
  });

  it('carries no version number that could drift from the registry', () => {
    expect(status).not.toMatch(/\d+\.\d+\.\d+/);
  });

  it('adds the project row: repository, license and brand next to the agent surfaces', () => {
    for (const label of [
      'Changelog',
      'llms.txt',
      'Agent skill',
      'Brand',
      'GitHub',
      'MIT license',
    ]) {
      expect(footer).toContain(`label: '${label}'`);
    }
    expect(footer).toContain("const REPOSITORY = 'https://github.com/DailybotHQ/texuli'");
    expect(footer).toContain('{REPOSITORY}/blob/main/LICENSE');
    expect(existsSync(resolve(REPO_ROOT, 'LICENSE'))).toBe(true);
    expect(routeExists('/brand/')).toBe(true);
  });

  it('resolves every project link through safeHref at the developer tier', () => {
    expect(footer).toContain("from '@texuli/core/url-policy'");
    expect(footer).toContain("safeHref(href, 'developer')");
    expect(footer).toContain('href={resolveHref(link.href)}');
  });
});

describe('header (row 12)', () => {
  it('keeps a 2.5rem search target on narrow phones instead of collapsing it to zero', () => {
    const narrow = styleOf(header).slice(styleOf(header).indexOf('@media (max-width: 30rem)'));
    const rule = narrow.slice(0, narrow.indexOf('}'));
    expect(rule).toContain('[data-tx-command-trigger]');
    expect(rule).toContain('min-inline-size: 2.5rem');
    expect(rule).not.toContain('min-inline-size: 0');
  });
});
