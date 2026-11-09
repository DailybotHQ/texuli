import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  liveSolutionRoutes,
  nextStepsView,
  recipesView,
  relatedSolutions,
} from '../../src/components/solutions/shared/resources/resources-model.ts';
import { getSolution, SOLUTIONS } from '../../src/data/solutions/index.ts';

const DIR = resolve(import.meta.dirname, '../../src/components/solutions/shared/resources');
const read = (name: string): string => readFileSync(resolve(DIR, name), 'utf8');
const BLOCKS = {
  recipes: read('SolutionRecipes.astro'),
  related: read('SolutionRelated.astro'),
  next: read('SolutionNextSteps.astro'),
};
const slides = getSolution('slides');

describe('SolutionRecipes view', () => {
  it('resolves recipe links and marks external ones', () => {
    const view = recipesView(
      {
        entry: slides,
        title: 'Recipes',
        recipes: [
          { title: 'Present a deck', summary: 'Mount the stage.', href: '/slides-page/' },
          {
            title: 'Install',
            summary: 'From npm.',
            href: 'https://www.npmjs.com/package/@texuli/slides',
          },
        ],
      },
      '/docs/'
    );
    expect(view.headingId).toBe('solution-recipes-slides');
    expect(view.recipes.map((r) => [r.href, r.external])).toEqual([
      ['/docs/slides-page/', false],
      ['https://www.npmjs.com/package/@texuli/slides', true],
    ]);
  });

  it('refuses empty grids, empty copy and unsafe links', () => {
    expect(() => recipesView({ entry: slides, title: 'R', recipes: [] })).toThrow(/at least one/);
    expect(() =>
      recipesView({ entry: slides, title: 'R', recipes: [{ title: 'x', summary: ' ', href: '/' }] })
    ).toThrow(/title and a summary/);
    expect(() =>
      recipesView({
        entry: slides,
        title: 'R',
        recipes: [{ title: 'x', summary: 'y', href: 'javascript:alert(1)' }],
      })
    ).toThrow(/unsafe href/);
  });
});

describe('related Solutions', () => {
  it('lists the other Solutions in registry order and links only live landing pages', () => {
    const live = liveSolutionRoutes([
      '../../../../pages/solutions/canvas/index.astro',
      '../../../../pages/solutions/index.astro',
      '../../../../pages/guides/index.astro',
    ]);
    expect([...live]).toEqual(['/solutions/canvas/']);
    const related = relatedSolutions(slides, SOLUTIONS, live, '/');
    expect(related.map((r) => r.slug)).toEqual(['documents', 'workflows', 'canvas', 'sheets']);
    expect(related.find((r) => r.slug === 'canvas')?.href).toBe('/solutions/canvas/');
    expect(related.filter((r) => r.href !== undefined)).toHaveLength(1);
    for (const r of related) {
      const entry = getSolution(r.slug as typeof slides.slug);
      expect([r.name, r.tagline, r.status]).toEqual([entry.name, entry.tagline, entry.status]);
    }
  });
});

describe('SolutionNextSteps view', () => {
  it('puts the docs link first as primary, then secondary, then text links', () => {
    const view = nextStepsView(
      {
        entry: slides,
        links: [
          { label: 'Current demo page', href: '/slides-page/' },
          { label: 'Read the docs', href: slides.docs },
          { label: 'npm', href: 'https://www.npmjs.com/package/@texuli/slides' },
        ],
      },
      '/'
    );
    expect(view.title).toBe('Start building with Slides');
    expect(view.sub).toBe(slides.tagline);
    expect(view.links.map((l) => [l.kind, l.href])).toEqual([
      ['primary', '/guides/solutions/slides/'],
      ['secondary', '/slides-page/'],
      ['text', 'https://www.npmjs.com/package/@texuli/slides'],
    ]);
  });

  it('refuses links without the docs route or with unsafe hrefs', () => {
    expect(() =>
      nextStepsView({ entry: slides, links: [{ label: 'Demo', href: '/slides-page/' }] })
    ).toThrow(/docs route/);
    expect(() =>
      nextStepsView({
        entry: slides,
        links: [
          { label: 'Docs', href: slides.docs },
          { label: 'Bad', href: '//evil.example/' },
        ],
      })
    ).toThrow(/unsafe href/);
  });
});

describe('closing blocks markup', () => {
  it('is static: one labelled h2 per block, no island, no HTML sinks', () => {
    for (const [name, source] of Object.entries(BLOCKS)) {
      expect(source, name).not.toMatch(/client:|set:html|\{@html|innerHTML|<script/);
      expect(source.match(/<h2\b/g), name).toHaveLength(1);
      expect(source, name).toMatch(/aria-labelledby=\{(view\.)?headingId\}/);
    }
  });

  it('wires each block to its view and the final band to the home-final art', () => {
    expect(BLOCKS.recipes).toContain('href={recipe.href}');
    expect(BLOCKS.related).toContain(
      "import.meta.glob('../../../../pages/solutions/*/index.astro')"
    );
    expect(BLOCKS.related).toContain('other.href ? <a href={other.href}>');
    expect(BLOCKS.next).toContain('<SiteIllustration art="home-final" />');
    expect(BLOCKS.next).toContain('href={link.href}');
  });
});
