import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { HERO_22, HERO_22_IDS } from '../../src/components/sections/home/hero-22/hero-content.ts';
import { HOME_IDS, wordCount } from '../../src/components/sections/home/home-content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const read = (path: string): string => readFileSync(resolve(WEBSITE, path), 'utf8');
const hero = read('src/components/sections/home/hero-22/HomeHero22.astro');

const pageFor = (href: string): string =>
  resolve(WEBSITE, 'src/pages', href.replace(/^\/+|\/+$/g, ''), 'index.astro');

/**
 * `/solutions/` is created by the plan's routes task (apps/website/docs/site-solutions.md,
 * ADR-029). Until that page exists, the hero's target must at least be the
 * route that doc declares; once the page lands, it must exist.
 */
const routeIsRealOrDeclared = (href: string): boolean => {
  if (existsSync(pageFor(href))) return true;
  if (href !== '/solutions/') return false;
  const doc = read('docs/site-solutions.md');
  return doc.includes('`/solutions/` (catalog)') && doc.includes('src/pages/solutions/index.astro');
};

const parity = JSON.parse(readFileSync(resolve(REPO, 'native/docs/parity.json'), 'utf8')) as {
  totals: { catalog: number; painted: number };
};

describe('Home 2.2 hero', () => {
  it('carries the storyboard eyebrow, the pinned accent h1 and a subhead within the 25-word budget', () => {
    expect(HERO_22.eyebrow).toEqual([
      'Open source',
      'Web + Native vision',
      'Built for humans and agents',
    ]);
    expect(`${HERO_22.title.lead} ${HERO_22.title.accent}`).toBe('Build any interface.');
    expect(wordCount(HERO_22.sub)).toBeLessThanOrEqual(25);
    expect(HERO_22.sub).toMatch(/web today/);
    expect(HERO_22.sub).toMatch(/native/);
    expect(JSON.stringify(HERO_22)).not.toMatch(/Run anywhere|Build once/i);
  });

  it('states platform status honestly: web available, native in development while it paints a slice', () => {
    const allowed = ['available', 'in development', 'experimental', 'planned'];
    for (const row of HERO_22.status) expect(allowed).toContain(row.status);
    const native = HERO_22.status.find((row) => row.id === 'native');
    const web = HERO_22.status.find((row) => row.id === 'web');
    expect(web?.status).toBe('available');
    expect(parity.totals.painted).toBeLessThan(parity.totals.catalog);
    expect(native?.status).toBe('in development');
  });

  it('offers Explore solutions, Explore native and Get started, each pointing at a real route', () => {
    expect(HERO_22.actions.map((link) => [link.label, link.href, link.role])).toEqual([
      ['Explore solutions', '/solutions/', 'primary'],
      ['Explore native', '/native/', 'secondary'],
      ['Get started', '/guides/getting-started/', 'text'],
    ]);
    for (const link of HERO_22.actions)
      expect(routeIsRealOrDeclared(link.href), link.href).toBe(true);
    expect(existsSync(pageFor('/native/'))).toBe(true);
    expect(existsSync(pageFor('/guides/getting-started/'))).toBe(true);
  });

  it('renders static markup: one labelled h1, URL-policy links, the eager home art and no island or sink', () => {
    expect((hero.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(hero).toContain('aria-labelledby={HERO_22_IDS.heading}');
    expect(hero).toContain('<h1 id={HERO_22_IDS.heading}>');
    expect(HERO_22_IDS.heading).not.toBe(HOME_IDS.hero);
    expect(hero).toContain('<span class="hero22__accent">{HERO_22.title.accent}</span>');
    expect(hero).toContain("safeHref(href, 'developer')");
    expect(hero).toContain('href={resolveHref(link.href)}');
    expect(hero).toContain('href={resolveHref(stat.href)}');
    expect(hero).toContain('<SiteIllustration art="home-hero" />');
    expect(illustrationFor('home-hero')?.priority).toBe(true);
    expect(hero).not.toMatch(/client:[a-z]+/);
    expect(hero).not.toMatch(/<script\b/);
    expect(hero).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(hero).not.toMatch(
      /margin-left|margin-right|padding-left|padding-right|\bleft:|\bright:/
    );
  });
});
