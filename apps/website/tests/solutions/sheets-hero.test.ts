import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import { solutionHeroView } from '../../src/components/solutions/shared/hero/hero-model.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import { SHEETS_HERO } from '../../src/components/solutions/sheets/hero/hero-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const HERO = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/sheets/hero/SheetsHero.astro'),
  'utf8'
);
const entry = getSolution('sheets');
const view = solutionHeroView({ entry, ...SHEETS_HERO });

describe('Sheets hero', () => {
  it('renders the headline, eyebrow and a short lede', () => {
    expect(view.eyebrow).toBe('Solution · Sheets');
    expect(view.title).toBe('A spreadsheet with formulas built to recalculate.');
    expect(view.headingId).toBe('solution-hero-sheets');
    expect(wordCount(view.title)).toBeLessThanOrEqual(10);
    expect(wordCount(view.lede)).toBeLessThanOrEqual(30);
  });

  it('states the honest status from the registry', () => {
    expect(view.status).toBe('in development');
    expect(view.statusText).toBe('Status: in development');
    const copy = JSON.stringify(SHEETS_HERO);
    expect(copy).not.toMatch(/\b(available|stable|production[- ]ready|1\.0)\b/i);
    expect(copy).not.toMatch(/PLAN_|plan 015|T-sheets/i);
  });

  it('points both calls to action at sections on the landing', () => {
    expect(view.ctas.map((cta) => cta.kind)).toEqual(['primary', 'secondary']);
    expect(SHEETS_HERO.ctas[0]?.href).toBe(`#${SOLUTION_SECTION_IDS.demo}`);
    expect(SHEETS_HERO.ctas[1]?.href).toBe(`#${SOLUTION_SECTION_IDS.quickstart}`);
    for (const cta of SHEETS_HERO.ctas) {
      expect(cta.href.startsWith('#')).toBe(true);
      expect(Object.values(SOLUTION_SECTION_IDS)).toContain(cta.href.slice(1));
    }
  });

  it('uses the registry art slot and its texel fallback', () => {
    expect(entry.art.hero).toEqual({ slot: 'solution-sheets-hero', variant: 'plate' });
    expect(SHEETS_HERO.art).toBeUndefined();
    expect(view.art).toEqual({ slot: 'solution-sheets-hero', variant: 'plate' });
    expect(view.artRegistered).toBe(true);
    expect(view.artAlt).toBe(illustrationFor('solution-sheets-hero')?.alt);
  });

  it('composes the shared static SolutionHero with the Sheets entry', () => {
    expect(HERO).toContain("import SolutionHero from '../../shared/hero/SolutionHero.astro'");
    expect(HERO).toContain("getSolution('sheets')");
    expect(HERO).toContain('<SolutionHero entry={entry} {...SHEETS_HERO} />');
    expect(HERO).not.toMatch(/client:|set:html|\{@html|<script/);
  });

  it('keeps the calls to action on real landing sections rather than missing routes', () => {
    expect(
      existsSync(resolve(WEBSITE, 'src/components/solutions/sheets/demo/SheetsDemo.svelte'))
    ).toBe(true);
    expect(
      existsSync(
        resolve(WEBSITE, 'src/components/solutions/sheets/quickstart/SheetsQuickstart.astro')
      )
    ).toBe(true);
    expect(SHEETS_HERO.ctas.some((cta) => cta.href === '/sheets-page/')).toBe(false);
  });
});
