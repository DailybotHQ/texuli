import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  heroTexels,
  resolveHeroHref,
  solutionHeroView,
} from '../../src/components/solutions/shared/hero/hero-model.ts';
import type { SolutionHeroProps } from '../../src/components/solutions/shared/types.ts';
import { getSolution, SOLUTIONS } from '../../src/data/solutions/index.ts';

const HERO_DIR = resolve(import.meta.dirname, '../../src/components/solutions/shared/hero');
const hero = readFileSync(resolve(HERO_DIR, 'SolutionHero.astro'), 'utf8');
const texels = readFileSync(resolve(HERO_DIR, 'HeroTexels.astro'), 'utf8');

const props = (overrides: Partial<SolutionHeroProps> = {}): SolutionHeroProps => ({
  entry: getSolution('slides'),
  eyebrow: 'Solution · Slides',
  title: 'Slides',
  lede: 'Write decks as JSON or Markdown and present them in the browser.',
  ctas: [
    { kind: 'primary', label: 'Try the demo', href: '#demo' },
    { kind: 'secondary', label: 'Current demo page', href: '/slides-page/' },
  ],
  ...overrides,
});

describe('SolutionHero view model', () => {
  it('takes the status and the hero art from the registry entry', () => {
    for (const entry of SOLUTIONS) {
      const view = solutionHeroView(props({ entry }));
      expect(view.status).toBe(entry.status);
      expect(view.statusText).toBe(`Status: ${entry.status}`);
      expect(view.art).toEqual(entry.art.hero);
      expect(view.headingId).toBe(`solution-hero-${entry.slug}`);
      expect(view.artAlt.length).toBeGreaterThan(0);
    }
  });

  it('flags slots that illustrations.json registers and uses an art override', () => {
    // solution-<slug>-hero is registered and ships its WebP (PLAN_015 art).
    expect(solutionHeroView(props()).artRegistered).toBe(true);
    expect(
      solutionHeroView(props({ art: { slot: 'unregistered-slot', variant: 'plate' } }))
        .artRegistered
    ).toBe(false);
    const view = solutionHeroView(props({ art: { slot: 'page-slides', variant: 'banner' } }));
    expect(view.artRegistered).toBe(true);
    expect(view.art.slot).toBe('page-slides');
  });

  it('resolves calls to action through the URL policy and the site base', () => {
    const view = solutionHeroView(props(), '/docs/');
    expect(view.ctas).toEqual([
      { kind: 'primary', label: 'Try the demo', href: '#demo' },
      { kind: 'secondary', label: 'Current demo page', href: '/docs/slides-page/' },
    ]);
    expect(resolveHeroHref('https://www.npmjs.com/package/@texuli/slides')).toBe(
      'https://www.npmjs.com/package/@texuli/slides'
    );
    expect(resolveHeroHref('javascript:alert(1)')).toBeUndefined();
    expect(resolveHeroHref('//evil.example/')).toBeUndefined();
  });

  it('refuses props that break the block contract', () => {
    const primary = { kind: 'primary', label: 'Go', href: '#demo' } as const;
    expect(() => solutionHeroView(props({ ctas: [] }))).toThrow(/one or two/);
    expect(() => solutionHeroView(props({ ctas: [primary, primary, primary] }))).toThrow(
      /one or two/
    );
    expect(() =>
      solutionHeroView(props({ ctas: [{ kind: 'secondary', label: 'Go', href: '#demo' }] }))
    ).toThrow(/primary/);
    expect(() =>
      solutionHeroView(props({ ctas: [{ ...primary, href: 'javascript:alert(1)' }] }))
    ).toThrow(/unsafe href/);
    expect(() => solutionHeroView(props({ title: '  ' }))).toThrow(/title is empty/);
  });

  it('paints stable, slot-seeded texels', () => {
    const a = heroTexels('solution-slides-hero');
    expect(a).toHaveLength(48);
    expect(a).toEqual(heroTexels('solution-slides-hero'));
    expect(a).not.toEqual(heroTexels('solution-sheets-hero'));
    expect(a.every((tone) => tone >= 0 && tone <= 4)).toBe(true);
  });
});

describe('SolutionHero markup', () => {
  it('is static: one labelled h1, no island and no HTML sinks', () => {
    for (const source of [hero, texels]) {
      expect(source).not.toMatch(/client:|set:html|\{@html|innerHTML/);
      expect(source).not.toMatch(/<script/);
    }
    expect(hero.match(/<h1\b/g)).toHaveLength(1);
    expect(hero).toContain('aria-labelledby={view.headingId}');
    expect(hero).toContain('<h1 id={view.headingId}>{view.title}</h1>');
  });

  it('prints eyebrow, lede, status and calls to action from the view', () => {
    expect(hero).toContain('{view.eyebrow}');
    expect(hero).toContain('{view.lede}');
    expect(hero).toContain('data-tx-solution-status={view.status}');
    expect(hero).toContain('{view.statusText}');
    expect(hero).toContain('href={cta.href}');
  });

  it('draws the art through SiteIllustration, with the texel plate for unregistered slots', () => {
    expect(hero).toContain(
      "import SiteIllustration from '../../../landing/SiteIllustration.astro'"
    );
    expect(hero).toContain('<SiteIllustration art={view.art.slot} />');
    expect(hero).toContain('<HeroTexels art={view.art.slot} alt={view.artAlt} />');
    expect(texels).toContain('role="img" aria-label={alt}');
  });
});
