// @vitest-environment node
/**
 * texuli.com home (Home 2.2): the band order and the ten storyboard messages, the copy
 * budgets of the bands kept from the first landing, the computed counts, the SEO bands,
 * the footer truth and opt-in motion. Each Home 2.2 section has its own test beside it
 * (tests/solutions/home-*.test.ts); this file checks the assembly.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadParity, parseNativeRegistry } from '../../../scripts/native-parity.ts';
import { NEVER_PACKED } from '../../../scripts/packages.ts';
import { COMPONENT_PAGES } from '../src/components/component-pages/load-manifests.ts';
import { buildExampleCatalog } from '../src/components/examples/catalog.ts';
import { REPOSITORY_URL } from '../src/components/foundation/site.ts';
import { illustrationFor } from '../src/components/landing/illustrations.ts';
import { PRIMITIVES } from '../src/components/primitives-page/primitives.ts';
import { HERO_22 } from '../src/components/sections/home/hero-22/hero-content.ts';
import {
  fillCopy,
  HOME_BANDS,
  HOME_INSTALL_COMMAND,
  HOME_OWN,
  HOME_PITCH,
  HOME_STORIES,
  loadHomeHeroProof,
  loadHomeProof,
  loadNativeSlice,
  wordCount,
} from '../src/components/sections/home/home-content.ts';
import { countAllThemes, HOME_NEVER_PACKED } from '../src/components/sections/home/home-data.ts';

const WEBSITE = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');
const styleOf = (source: string): string => source.slice(source.lastIndexOf('<style>'));
/** A page route, and its `#fragment` target when it names one. */
const routeExists = (href: string): boolean => {
  const [path = '', fragment] = href.split('#');
  const page = resolve(WEBSITE, 'src/pages', path.replace(/^\/+|\/+$/g, ''), 'index.astro');
  return existsSync(page) && (!fragment || readFileSync(page, 'utf8').includes(`id="${fragment}"`));
};

const home = read('src/pages/index.astro');
const footer = read('src/components/foundation/SiteFooter.astro');
const header = read('src/components/foundation/SiteHeader.astro');
/** The band components index.astro renders, in order (one per top-level line). */
const renderedBands = [...home.matchAll(/^\s{4}<(Home\w+|LandingStory)\b/gm)].map((m) => m[1]);

describe('landing', () => {
  it('renders the Home 2.2 bands in the HOME_BANDS order', () => {
    expect(renderedBands).toEqual(HOME_BANDS.map((band) => band.component));
    expect(renderedBands).toEqual([
      'HomeHero22',
      'HomePitch',
      'HomeWebNative',
      'HomeSolutions',
      'HomeAgents22',
      'HomeStories',
      'HomeBuiltWith',
      'LandingStory',
      'HomeFinal22',
    ]);
    for (const retired of ['<HomeHero />', '<HomeProof />', '<HomeQuickstart />', '<HomeFinal />'])
      expect(home, retired).not.toContain(retired);
  });

  it('covers the ten storyboard messages once each, in storyboard order', () => {
    const targets = HOME_BANDS.flatMap((band) => [...band.targets]);
    expect(new Set(targets).size).toBe(10);
    expect([...targets].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))).toEqual(
      Array.from({ length: 10 }, (_, i) => `T${i + 1}`)
    );
    // T5 rides with T3 in the Web & Native band (storyboard decision); everything else is in order.
    expect(targets).toEqual(['T1', 'T2', 'T3', 'T5', 'T4', 'T6', 'T7', 'T8', 'T9', 'T10']);
    expect(HOME_BANDS.findIndex((band) => band.id === 'web-native')).toBeLessThan(
      HOME_BANDS.length / 2
    );
  });

  it('stays static: no client island and one hero h1', () => {
    expect(home).not.toMatch(/client:[a-z]+/);
    expect(home).not.toMatch(/<script\b/);
    expect(read('src/components/sections/home/hero-22/HomeHero22.astro')).toMatch(/<h1\b/);
    for (const file of [
      'web-native/HomeWebNative.astro',
      'solutions/HomeSolutions.astro',
      'agents-22/HomeAgents22.astro',
      'built-with/HomeBuiltWith.astro',
      'final-22/HomeFinal22.astro',
      'HomePitch.astro',
      'LandingStory.astro',
    ])
      expect(read(`src/components/sections/home/${file}`), file).not.toMatch(/<h1\b|client:[a-z]+/);
  });

  it('counts the real catalog, primitives, themes and examples in the hero proof row', async () => {
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
    const hero = read('src/components/sections/home/hero-22/HomeHero22.astro');
    expect(hero).toContain('href={resolveHref(stat.href)}');
    expect(hero).toContain('<CopyCommand command={HOME_INSTALL_COMMAND} />');
    expect(HOME_INSTALL_COMMAND).toBe('pnpm add texuli @texuli/tokens');
    expect(`${HERO_22.title.lead} ${HERO_22.title.accent}`).toBe('Build any interface.');
    // One copy command on the page: the hero's.
    expect(home).not.toContain('CopyCommand');
    expect(read('src/components/sections/home/final-22/HomeFinal22.astro')).not.toContain(
      'CopyCommand'
    );
  });

  it('keeps the pitch ladder ending in Solutions, with real routes and its budget', () => {
    expect(HOME_PITCH.title).toBe('Small pieces. Infinite possibilities.');
    expect(wordCount(HOME_PITCH.body)).toBeLessThanOrEqual(40);
    expect(HOME_PITCH.steps.map((step) => step.label)).toEqual([
      'Texels',
      'Primitives',
      'Components',
      'Solutions',
    ]);
    for (const step of HOME_PITCH.steps) expect(routeExists(step.href), step.href).toBe(true);
    expect(illustrationFor(HOME_PITCH.slot)?.variant).toBe('plate');
  });

  it('keeps the design-systems story and the accessible story within budget, with plates and real links', () => {
    expect(HOME_STORIES.map((story) => story.id)).toEqual(['brand']);
    const stories = [...HOME_STORIES, HOME_OWN];
    for (const story of stories) {
      expect(wordCount(fillCopy(story.body, { themeCount: 210 })), story.id).toBeLessThanOrEqual(
        40
      );
      expect(story.points?.length ?? 0, story.id).toBeLessThanOrEqual(3);
      expect(illustrationFor(story.slot)?.variant, story.slot).toBe('plate');
      for (const item of [...(story.points ?? []), ...(story.actions ?? [])])
        if (item.href) expect(routeExists(item.href), item.href).toBe(true);
    }
    expect(HOME_OWN.title).toBe('Accessible and owned.');
    expect(home).toContain('<LandingStory story={HOME_OWN} index={2} side="start">');
    const copy = JSON.stringify([HOME_PITCH, stories]);
    expect(copy).not.toMatch(/\bAct\b|\bActo\b|PLAN_/);
  });

  it('puts the computed proof row inside the accessible story, through the URL policy', async () => {
    const proof = await loadHomeProof();
    const catalog = JSON.parse(read('../../packages/spec/catalog/components.json')) as {
      components: { emit: string[] }[];
    };
    const manifests = readdirSync(resolve(WEBSITE, '../../packages'))
      .map((dir) => resolve(WEBSITE, '../../packages', dir, 'package.json'))
      .filter((path) => existsSync(path))
      .map((path) => JSON.parse(readFileSync(path, 'utf8')) as { name: string });
    expect(HOME_NEVER_PACKED).toEqual(NEVER_PACKED);
    const published = manifests.filter((manifest) => !NEVER_PACKED.includes(manifest.name)).length;
    expect(proof.map((stat) => [stat.id, stat.value])).toEqual([
      ['packages', published],
      ['blueprint', catalog.components.length],
      ['agent-safe', catalog.components.filter((entry) => entry.emit.includes('untrusted')).length],
    ]);
    for (const stat of proof) expect(routeExists(stat.href), stat.href).toBe(true);
    const own = home.slice(home.indexOf('<LandingStory'), home.indexOf('</LandingStory>'));
    expect(own).toContain('class="home-own-proof" role="list" aria-label={HOME_PROOF.label}');
    expect(own).toContain('href={resolveHref(stat.href)}');
    expect(home).toContain("safeHref(href, 'developer')");
    expect(home).not.toMatch(/>\s*\d{2,}\s*</);
  });

  it('states the native slice from the generated parity matrix, never typed in', () => {
    const fixture = [
      'val implemented: Set<String> = setOf(',
      '  "layout-page",',
      '  // 0.8.0 (ADR-016): a comment with parentheses',
      '  "blocks-code",',
      ') + compactCharts',
      'private val compactCharts = setOf("charts-gauge")',
    ].join('\n');
    expect(parseNativeRegistry(fixture)).toEqual(['blocks-code', 'charts-gauge', 'layout-page']);
    const report = loadParity(resolve(WEBSITE, '../..'));
    expect(loadNativeSlice()).toEqual({
      painted: report.totals.painted,
      total: report.totals.catalog,
    });
    expect(() => fillCopy('{missing}', {})).toThrow('no value for {missing}');
  });

  it('links every Home 2.2 call to action that is a site route to an existing page', () => {
    for (const action of HERO_22.actions) expect(routeExists(action.href), action.href).toBe(true);
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

  it('keeps the home styles logical', () => {
    const css = read('src/components/sections/home/home.css');
    expect(css).not.toMatch(/margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/);
  });
});
