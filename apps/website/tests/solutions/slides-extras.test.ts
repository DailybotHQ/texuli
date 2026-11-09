import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DECK_GRAMMAR_IDS } from '@texuli/catalog';
import { describe, expect, it } from 'vitest';
import {
  agentSurfaceViews,
  platformRows,
} from '../../src/components/solutions/shared/platforms/platforms-model.ts';
import {
  nextStepsView,
  recipesView,
} from '../../src/components/solutions/shared/resources/resources-model.ts';
import {
  SLIDES_AGENTS,
  SLIDES_NEXT,
  SLIDES_PLATFORMS,
  SLIDES_RECIPES,
} from '../../src/components/solutions/slides/extras/extras-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const ROOT = resolve('.');
const WEBSITE = resolve(import.meta.dirname, '../..');
const EXTRAS = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/slides/extras/SlidesExtras.astro'),
  'utf8'
);
const entry = getSolution('slides');

function pageExists(href: string): boolean {
  return existsSync(resolve(WEBSITE, 'src/pages', href.replace(/^\/|\/$/g, ''), 'index.astro'));
}

describe('Slides extras', () => {
  it('takes platform rows from the registry without raising native status', () => {
    expect(SLIDES_PLATFORMS.title).toBe('Platforms');
    const rows = platformRows(entry);
    expect(rows.map((row) => [row.platform, row.badge.status])).toEqual([
      ['web', 'in development'],
      ['compose-desktop', 'planned'],
      ['android', 'planned'],
      ['ios', 'planned'],
    ]);
    expect(entry.platforms.find((row) => row.platform === 'web')?.status).toBe('in development');
    for (const row of entry.platforms.filter((row) => row.platform !== 'web')) {
      expect(row.status).toBe('planned');
    }
  });

  it('names only MCP, catalog and skill surfaces that exist for decks', () => {
    const labels = SLIDES_AGENTS.surfaces.map((surface) => surface.label);
    expect(labels).toEqual([
      'deck.run',
      DECK_GRAMMAR_IDS.deck,
      DECK_GRAMMAR_IDS.slide,
      'skills/texuli/build-ui/references/decks.md',
    ]);
    const deckOp = readFileSync(resolve(ROOT, 'packages/tools/src/ops/deck.ts'), 'utf8');
    expect(deckOp).toContain("name: 'deck.run'");
    expect(existsSync(resolve(ROOT, 'skills/texuli/build-ui/references/decks.md'))).toBe(true);
    expect(agentSurfaceViews(SLIDES_AGENTS.surfaces).map((view) => view.badge.status)).toEqual([
      'in development',
      'in development',
      'in development',
      'in development',
    ]);
    expect(JSON.stringify(SLIDES_AGENTS)).not.toMatch(/PLAN_|plan 015/i);
  });

  it('links recipes only to pages or packages that exist', () => {
    const view = recipesView({ entry, ...SLIDES_RECIPES });
    expect(view.recipes.length).toBeGreaterThan(0);
    for (const recipe of SLIDES_RECIPES.recipes) {
      if (recipe.href.startsWith('https:')) {
        expect(recipe.href).toMatch(/^https:\/\/www\.npmjs\.com\/package\/@texuli\/(deck|slides)$/);
      } else {
        expect(pageExists(recipe.href), recipe.href).toBe(true);
        expect(recipe.href.startsWith('/solutions/')).toBe(false);
      }
    }
  });

  it('puts the docs route on next steps and keeps the live demo as a second link', () => {
    const view = nextStepsView({ entry, ...SLIDES_NEXT });
    expect(SLIDES_NEXT.links.some((link) => link.href === entry.docs)).toBe(true);
    expect(view.links[0]).toMatchObject({ href: '/guides/solutions/slides/', kind: 'primary' });
    // /slides-page/ redirects here once the landing ships (ADR-028), so no block links it.
    expect(view.links.some((link) => link.href === '/slides-page/')).toBe(false);
  });

  it('composes the five shared blocks statically', () => {
    expect(EXTRAS).toContain('SolutionRecipes');
    expect(EXTRAS).toContain('SolutionAgents');
    expect(EXTRAS).toContain('SolutionPlatforms');
    expect(EXTRAS).toContain('SolutionRelated');
    expect(EXTRAS).toContain('SolutionNextSteps');
    expect(EXTRAS).toContain("getSolution('slides')");
    expect(EXTRAS).not.toMatch(/client:|set:html|\{@html/);
    expect(EXTRAS).not.toMatch(/PLAN_|docs-solutions/);
  });
});
