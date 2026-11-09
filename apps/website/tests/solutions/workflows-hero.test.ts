import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import { solutionHeroView } from '../../src/components/solutions/shared/hero/hero-model.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import { WORKFLOWS_HERO } from '../../src/components/solutions/workflows/hero/hero-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const HERO = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/workflows/hero/WorkflowsHero.astro'),
  'utf8'
);
const entry = getSolution('workflows');
const view = solutionHeroView({ entry, ...WORKFLOWS_HERO });

describe('Workflows hero', () => {
  it('renders the headline, eyebrow and a short lede', () => {
    expect(view.eyebrow).toBe('Solution · Workflows');
    expect(view.title).toBe('Workflow graphs you can draw, check and embed.');
    expect(view.headingId).toBe('solution-hero-workflows');
    expect(wordCount(view.title)).toBeLessThanOrEqual(10);
    expect(wordCount(view.lede)).toBeLessThanOrEqual(30);
  });

  it('states the honest status from the registry, never in the copy', () => {
    expect(view.status).toBe('in development');
    expect(view.statusText).toBe('Status: in development');
    const copy = JSON.stringify(WORKFLOWS_HERO);
    expect(copy).not.toMatch(/\b(available|stable|production[- ]ready|1\.0)\b/i);
    expect(copy).not.toMatch(/PLAN_|plan 015|T-workflows/i);
  });

  it('points every call to action at a real route', () => {
    expect(view.ctas.map((c) => c.kind)).toEqual(['primary', 'secondary']);
    for (const cta of WORKFLOWS_HERO.ctas) {
      if (cta.href.startsWith('#')) {
        expect(Object.values(SOLUTION_SECTION_IDS)).toContain(cta.href.slice(1));
      } else {
        const page = resolve(WEBSITE, 'src/pages', cta.href.replace(/^\/|\/$/g, ''), 'index.astro');
        expect(existsSync(page), cta.href).toBe(true);
      }
    }
    expect(WORKFLOWS_HERO.ctas[0]?.href).toBe(`#${SOLUTION_SECTION_IDS.demo}`);
  });

  it('uses the solution-workflows-hero plate and paints texels until the slot is registered', () => {
    expect(WORKFLOWS_HERO.art).toBeUndefined();
    expect(view.art).toEqual({ slot: 'solution-workflows-hero', variant: 'plate' });
    expect(typeof view.artRegistered).toBe('boolean');
    expect(view.artAlt.length).toBeGreaterThan(0);
  });

  it('composes the shared SolutionHero with the workflows entry, statically', () => {
    expect(HERO).toContain("import SolutionHero from '../../shared/hero/SolutionHero.astro'");
    expect(HERO).toContain("getSolution('workflows')");
    expect(HERO).toContain('<SolutionHero entry={entry} {...WORKFLOWS_HERO} />');
    expect(HERO).not.toMatch(/client:|set:html|\{@html|<script/);
  });
});

describe('Workflows hero scope', () => {
  it('sends the secondary call to action to the quickstart and never claims a runtime', () => {
    expect(WORKFLOWS_HERO.ctas[1]?.href).toBe(`#${SOLUTION_SECTION_IDS.quickstart}`);
    const copy = JSON.stringify(WORKFLOWS_HERO);
    expect(copy).not.toMatch(/\b(runtime|execute|executes|automation service|hosted|cloud)\b/i);
    expect(WORKFLOWS_HERO.lede).toMatch(/Your app runs them\.$/);
    expect(entry.limits.join(' ')).toContain('it does not run workflows');
  });
});
