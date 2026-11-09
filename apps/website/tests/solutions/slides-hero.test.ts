import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import { solutionHeroView } from '../../src/components/solutions/shared/hero/hero-model.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import { SLIDES_HERO } from '../../src/components/solutions/slides/hero/hero-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const HERO = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/slides/hero/SlidesHero.astro'),
  'utf8'
);
const entry = getSolution('slides');
const view = solutionHeroView({ entry, ...SLIDES_HERO });

describe('Slides hero', () => {
  it('renders the headline, eyebrow and a short lede', () => {
    expect(view.eyebrow).toBe('Solution · Slides');
    expect(view.title).toBe('Decks written as data, presented on the web.');
    expect(view.headingId).toBe('solution-hero-slides');
    expect(wordCount(view.title)).toBeLessThanOrEqual(10);
    expect(wordCount(view.lede)).toBeLessThanOrEqual(30);
  });

  it('states the honest status from the registry, never in the copy', () => {
    expect(view.status).toBe('in development');
    expect(view.statusText).toBe('Status: in development');
    const copy = JSON.stringify(SLIDES_HERO);
    expect(copy).not.toMatch(/\b(available|stable|production[- ]ready|1\.0)\b/i);
    expect(copy).not.toMatch(/PLAN_|plan 015|T-slides/i);
  });

  it('points every call to action at a real route', () => {
    expect(view.ctas.map((c) => c.kind)).toEqual(['primary', 'secondary']);
    for (const cta of SLIDES_HERO.ctas) {
      if (cta.href.startsWith('#')) {
        expect(Object.values(SOLUTION_SECTION_IDS)).toContain(cta.href.slice(1));
      } else {
        const page = resolve(WEBSITE, 'src/pages', cta.href.replace(/^\/|\/$/g, ''), 'index.astro');
        expect(existsSync(page), cta.href).toBe(true);
      }
    }
    expect(SLIDES_HERO.ctas[0]?.href).toBe(`#${SOLUTION_SECTION_IDS.demo}`);
  });

  it('uses the solution-slides-hero plate and paints texels until the slot is registered', () => {
    expect(SLIDES_HERO.art).toBeUndefined();
    expect(view.art).toEqual({ slot: 'solution-slides-hero', variant: 'plate' });
    expect(typeof view.artRegistered).toBe('boolean');
    expect(view.artAlt.length).toBeGreaterThan(0);
  });

  it('composes the shared SolutionHero with the slides entry, statically', () => {
    expect(HERO).toContain("import SolutionHero from '../../shared/hero/SolutionHero.astro'");
    expect(HERO).toContain("getSolution('slides')");
    expect(HERO).toContain('<SolutionHero entry={entry} {...SLIDES_HERO} />');
    expect(HERO).not.toMatch(/client:|set:html|\{@html|<script/);
  });
});
