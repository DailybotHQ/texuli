// @vitest-environment node
/**
 * The landing, header and footer contracts (T-79, T-84): the hero proof
 * counts are computed from the sources they link to; the home metadata sits
 * inside the SEO audit's length bands; the footer states the release truth
 * with no version number that could drift; repository links go through the
 * URL policy from one constant; and motion is opt-in under reduced motion.
 * Templates are read as source (the root config does not compile .astro);
 * the rendered pages are covered by tests/e2e/site-*.spec.ts with axe.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPONENT_PAGES } from '../src/components/component-pages/load-manifests.ts';
import { buildExampleCatalog } from '../src/components/examples/catalog.ts';
import { REPOSITORY_URL } from '../src/components/foundation/site.ts';
import { illustrationFor } from '../src/components/landing/illustrations.ts';
import { PRIMITIVES } from '../src/components/primitives-page/primitives.ts';
import {
  HOME_HERO,
  HOME_INSTALL_COMMAND,
  loadHomeHeroProof,
  wordCount,
} from '../src/components/sections/home/home-content.ts';
import { countAllThemes } from '../src/components/sections/web/web-hero-content.ts';

const WEBSITE = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');
const styleOf = (source: string): string => source.slice(source.lastIndexOf('<style>'));
const routeExists = (href: string): boolean =>
  existsSync(resolve(WEBSITE, 'src/pages', href.replace(/^\/+|\/+$/g, ''), 'index.astro'));

const home = read('src/pages/index.astro');
const footer = read('src/components/foundation/SiteFooter.astro');
const header = read('src/components/foundation/SiteHeader.astro');

describe('landing', () => {
  it('counts the real catalog, primitives, themes and examples, each linked to its listing through the URL policy', async () => {
    const proof = await loadHomeHeroProof();
    expect(proof.map((stat) => [stat.id, stat.value, stat.href])).toEqual([
      ['components', COMPONENT_PAGES.length, '/component-pages/'],
      ['primitives', PRIMITIVES.length, '/primitives-page/'],
      ['themes', await countAllThemes(), '/gallery-themes/'],
      ['examples', buildExampleCatalog().length, '/examples/'],
    ]);
    for (const stat of proof) {
      expect(stat.value, stat.id).toBeGreaterThan(0);
      expect(routeExists(stat.href), stat.href).toBe(true);
    }
    const hero = read('src/components/sections/home/HomeHero.astro');
    expect(hero).toMatch(/href=\{resolveHref\(stat\.href\)\}/);
    expect(hero).not.toMatch(/>\s*\d{2,}\s*</);
  });

  it('keeps the hero to one value proposition: badge, accent h1, a short sub, three real calls to action, one install line and the eager art', () => {
    const hero = read('src/components/sections/home/HomeHero.astro');
    expect(HOME_HERO.badge).toEqual(['Open source', 'MIT', 'Svelte 5', 'Kotlin Multiplatform']);
    expect(`${HOME_HERO.title.lead} ${HOME_HERO.title.accent}`).toBe('Build any interface.');
    expect(hero).toContain('<span class="home-hero__accent">{HOME_HERO.title.accent}</span>');
    expect(wordCount(HOME_HERO.sub)).toBeLessThanOrEqual(25);
    expect(HOME_HERO.sub).toMatch(/Svelte 5/);
    expect(HOME_HERO.sub).toMatch(/Kotlin Multiplatform twin in development/);
    expect(HOME_HERO.actions.map((link) => link.role)).toEqual(['primary', 'secondary', 'text']);
    for (const link of HOME_HERO.actions) expect(routeExists(link.href), link.href).toBe(true);
    expect(hero).toContain('href={resolveHref(link.href)}');
    expect(HOME_INSTALL_COMMAND).toBe('pnpm add texuli');
    expect(hero).toContain('<CopyCommand command={HOME_INSTALL_COMMAND} />');
    expect(hero).toContain('<SiteIllustration slot="home-hero" />');
    expect(illustrationFor('home-hero')?.priority).toBe(true);
    expect((hero.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(hero).not.toMatch(/<pre\b/);
  });

  it('keeps the home title and description inside the SEO audit bands', () => {
    const title = /const HOME_TITLE = '([^']+)'/.exec(home)?.[1] ?? '';
    const description = (/const HOME_DESCRIPTION =([\s\S]*?);/.exec(home)?.[1] ?? '')
      .split('+')
      .map((part) => part.trim().replace(/^'|'$/g, ''))
      .join('');
    const fullTitle = `${title} · Texuli`;
    expect(fullTitle.length).toBeGreaterThanOrEqual(12);
    expect(fullTitle.length).toBeLessThanOrEqual(65);
    expect(description.length).toBeGreaterThanOrEqual(50);
    expect(description.length).toBeLessThanOrEqual(165);
    expect(description).toContain('Kotlin Multiplatform renderer in development');
    expect(home).toContain('title={HOME_TITLE}');
    expect(home).toContain('description={HOME_DESCRIPTION}');
  });

  it('states the release truth without a version, and routes repository links through safeHref', () => {
    const status = /<p class="site-footer__status"[\s\S]*?<\/p>/.exec(footer)?.[0] ?? '';
    expect(status).toMatch(/Pre-1\.0 packages are on\s+npm/);
    expect(status).toMatch(/no stable release yet/);
    expect(status).toMatch(/native renderer is in development/);
    expect(status).not.toMatch(/\d+\.\d+\.\d+/);

    expect(REPOSITORY_URL).toBe('https://github.com/DailybotHQ/texuli');
    expect(footer).toContain("safeHref(href, 'developer')");
    expect(footer).toContain('href={resolveHref(link.href)}');
    expect(footer).toContain("{ href: REPOSITORY_URL, label: 'GitHub' }");
    expect(header).toContain("safeHref(REPOSITORY_URL, 'developer')");
    for (const source of [footer, header]) {
      expect(source).not.toContain("'https://github.com/DailybotHQ/texuli'");
    }
    expect(existsSync(resolve(WEBSITE, '../../LICENSE'))).toBe(true);

    // The phone search trigger keeps a 2.5rem target instead of collapsing.
    const narrow = styleOf(header).slice(styleOf(header).indexOf('@media (max-width: 30rem)'));
    const rule = narrow.slice(0, narrow.indexOf('}'));
    expect(rule).toContain('[data-tx-command-trigger]');
    expect(rule).toContain('min-inline-size: 2.5rem');
  });

  it('animates the landing only on opt-in, by transform, and every base page carries reduced motion', () => {
    const style = styleOf(home);
    const gate = style.indexOf('@media (prefers-reduced-motion: no-preference)');
    const supports = style.indexOf('@supports (animation-timeline: view())');
    expect(gate).toBeGreaterThan(-1);
    expect(supports).toBeGreaterThan(gate);
    expect(style.indexOf('animation-name:')).toBeGreaterThan(supports);
    // No full shorthand: the minifier would fold the timeline into it.
    expect(style).not.toMatch(/\banimation:\s/);
    const keyframes = style.slice(style.indexOf('@keyframes'));
    expect(keyframes).toMatch(/translate:/);
    expect(keyframes).not.toMatch(/opacity|visibility|clip-path/);

    for (const layout of [
      'src/layouts/BaseLayout.astro',
      'src/layouts/ExamplePreviewLayout.astro',
      'src/pages/gallery-components/preview.astro',
    ]) {
      expect(read(layout), layout).toContain("import '@texuli/tokens/base.css';");
    }
    const reduced = read('../../packages/tokens/src/css/base.css').split(
      '@media (prefers-reduced-motion: reduce)'
    )[1];
    // 0s durations AND delays (G78): a tiny duration still lets visibility lag.
    for (const rule of [
      'animation-duration: 0s !important;',
      'animation-delay: 0s !important;',
      'transition-duration: 0s !important;',
      'transition-delay: 0s !important;',
    ]) {
      expect(reduced).toContain(rule);
    }
  });
});
