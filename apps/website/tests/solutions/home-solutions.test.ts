import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import {
  HOME_SOLUTIONS_COPY,
  homeSolutionCards,
  homeSolutionsCatalog,
  nativeStatus,
} from '../../src/components/sections/home/solutions/solutions-content.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import type { SolutionEntry } from '../../src/data/solutions/schema.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const source = readFileSync(
  resolve(WEBSITE, 'src/components/sections/home/solutions/HomeSolutions.astro'),
  'utf8'
);
const markup = source.slice(source.lastIndexOf('---') + 3, source.indexOf('<style>'));
const styles = source.slice(source.indexOf('<style>'));
const all = () => true;
const none = () => false;

describe('home Solutions band content', () => {
  it('uses the storyboard copy within the home budgets and the home-universe plate', () => {
    expect(HOME_SOLUTIONS_COPY.title).toBe('More than widgets: complete systems.');
    expect(wordCount(HOME_SOLUTIONS_COPY.body)).toBeLessThanOrEqual(40);
    expect(illustrationFor(HOME_SOLUTIONS_COPY.art)?.variant).toBe('plate');
    expect(JSON.stringify(HOME_SOLUTIONS_COPY)).not.toMatch(/PLAN_|\bavailable\b|cloud|hosted/i);
  });

  it('makes one card per registry Solution, in catalog order, with registry facts', () => {
    const cards = homeSolutionCards();
    expect(cards.map((c) => c.slug)).toEqual(SOLUTIONS.map((s) => s.slug));
    for (const [i, card] of cards.entries()) {
      const entry = SOLUTIONS[i] as SolutionEntry;
      expect(card.name).toBe(entry.name);
      expect(card.tagline).toBe(entry.tagline);
      expect(card.status).toBe(entry.status);
      expect(card.web).toBe(entry.platforms.find((p) => p.platform === 'web')?.status);
      expect(card.native).toBe(nativeStatus(entry));
    }
  });

  it('takes the most advanced native status, never above what the entry lists', () => {
    const base = SOLUTIONS[0] as SolutionEntry;
    const at = (platforms: SolutionEntry['platforms']) => nativeStatus({ ...base, platforms });
    expect(at([{ platform: 'web', status: 'available', evidence: [] }])).toBe('planned');
    expect(
      at([
        { platform: 'web', status: 'available', evidence: [] },
        { platform: 'android', status: 'planned', evidence: [] },
        { platform: 'compose-desktop', status: 'experimental', evidence: ['x'] },
      ])
    ).toBe('experimental');
    for (const entry of SOLUTIONS.filter((solution) => solution.slug !== 'design-systems'))
      expect(nativeStatus(entry), entry.slug).toBe('planned');
    expect(nativeStatus(SOLUTIONS.find((entry) => entry.slug === 'design-systems')!)).toBe(
      'in development'
    );
  });

  it('links the landing when it exists, else the current demo page, else nothing', () => {
    for (const card of homeSolutionCards(all)) expect(card.link?.kind).toBe('landing');
    for (const card of homeSolutionCards(none)) expect(card.link).toBeUndefined();
    const replacesOnly = (route: string) => SOLUTIONS.some((s) => s.replaces === route);
    for (const [i, card] of homeSolutionCards(replacesOnly).entries()) {
      const entry = SOLUTIONS[i];
      if (entry?.replaces) {
        expect(card.link?.kind).toBe('demo');
        expect(card.link?.href).toBe(entry.replaces);
      } else {
        expect(card.link).toBeUndefined();
      }
    }
    expect(homeSolutionsCatalog(none)).toBeUndefined();
    expect(homeSolutionsCatalog(all)?.href).toBe('/solutions/');
  });

  it('links only real routes in this checkout, and never a *-page once its landing exists', () => {
    for (const card of homeSolutionCards()) {
      if (!card.link) continue;
      expect(siteRouteExists(card.link.href), card.link.href).toBe(true);
      const entry = SOLUTIONS.find((s) => s.slug === card.slug) as SolutionEntry;
      if (siteRouteExists(entry.route)) expect(card.link.href).toBe(entry.route);
    }
    const catalog = homeSolutionsCatalog();
    if (catalog) expect(siteRouteExists(catalog.href)).toBe(true);
  });
});

describe('home Solutions band markup', () => {
  it('is a labelled section with one h2 and one h3 per card, and the shared status badge', () => {
    expect(markup).toContain('aria-labelledby={copy.id}');
    expect((markup.match(/<h2\b/g) ?? []).length).toBe(1);
    expect((markup.match(/<h3\b/g) ?? []).length).toBe(1);
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup).toContain('<StatusBadge status={card.web} context="Web" />');
    expect(markup).toContain('<StatusBadge status={card.native} context="Native" />');
    expect(markup).toContain('<SiteIllustration art={copy.art} />');
  });

  it('is static and safe, with URL-policy links and logical CSS', () => {
    expect(markup).not.toMatch(/client:[a-z]+/);
    expect(source).not.toMatch(/<script\b/);
    expect(source).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(source).toContain("safeHref(href, 'developer')");
    for (const href of markup.match(/href=\{[^}]+\}/g) ?? [])
      expect(href).toMatch(/^href=\{resolveHref\(/);
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});
