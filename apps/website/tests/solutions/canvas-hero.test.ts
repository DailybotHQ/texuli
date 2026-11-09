import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import { CANVAS_HERO } from '../../src/components/solutions/canvas/hero/hero-content.ts';
import { solutionHeroView } from '../../src/components/solutions/shared/hero/hero-model.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const HERO = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/canvas/hero/CanvasHero.astro'),
  'utf8'
);
const entry = getSolution('canvas');
const view = solutionHeroView({ entry, ...CANVAS_HERO });

describe('Canvas hero', () => {
  it('renders the headline, eyebrow and a short lede', () => {
    expect(view.eyebrow).toBe('Solution · Canvas');
    expect(view.title).toBe('A canvas for sketches, diagrams and ideas.');
    expect(view.headingId).toBe('solution-hero-canvas');
    expect(wordCount(view.title)).toBeLessThanOrEqual(10);
    expect(wordCount(view.lede)).toBeLessThanOrEqual(30);
  });

  it('states the honest status from the registry', () => {
    expect(view.status).toBe('in development');
    expect(view.statusText).toBe('Status: in development');
    const copy = JSON.stringify(CANVAS_HERO);
    expect(copy).not.toMatch(/\b(available|stable|production[- ]ready|1\.0)\b/i);
    expect(copy).not.toMatch(/PLAN_|plan 015|T-canvas/i);
  });

  it('points both calls to action at sections on the landing', () => {
    expect(view.ctas.map((cta) => cta.kind)).toEqual(['primary', 'secondary']);
    expect(CANVAS_HERO.ctas[0]?.href).toBe(`#${SOLUTION_SECTION_IDS.demo}`);
    expect(CANVAS_HERO.ctas[1]?.href).toBe(`#${SOLUTION_SECTION_IDS.quickstart}`);
    for (const cta of CANVAS_HERO.ctas) {
      expect(cta.href.startsWith('#')).toBe(true);
      expect(Object.values(SOLUTION_SECTION_IDS)).toContain(cta.href.slice(1));
    }
  });

  it('uses the registry art slot and its texel fallback', () => {
    expect(entry.art.hero).toEqual({ slot: 'solution-canvas-hero', variant: 'plate' });
    expect(CANVAS_HERO.art).toBeUndefined();
    expect(view.art).toEqual({ slot: 'solution-canvas-hero', variant: 'plate' });
    expect(view.artRegistered).toBe(false);
    expect(view.artAlt).toBe('Illustration of Canvas, made of small texels.');
  });

  it('composes the shared static SolutionHero with the canvas entry', () => {
    expect(HERO).toContain("import SolutionHero from '../../shared/hero/SolutionHero.astro'");
    expect(HERO).toContain("getSolution('canvas')");
    expect(HERO).toContain('<SolutionHero entry={entry} {...CANVAS_HERO} />');
    expect(HERO).not.toMatch(/client:|set:html|\{@html|<script/);
  });

  it('keeps the calls to action on real landing sections rather than missing routes', () => {
    for (const id of [SOLUTION_SECTION_IDS.demo, SOLUTION_SECTION_IDS.quickstart]) {
      expect(id).toBeTruthy();
    }
    expect(
      existsSync(
        resolve(WEBSITE, 'src/components/solutions/canvas/quickstart/CanvasQuickstart.astro')
      )
    ).toBe(true);
    expect(CANVAS_HERO.ctas.some((cta) => cta.href === '/canvas-page/')).toBe(false);
  });
});
