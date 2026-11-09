import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import { DOCUMENTS_HERO } from '../../src/components/solutions/documents/hero/hero-content.ts';
import { solutionHeroView } from '../../src/components/solutions/shared/hero/hero-model.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const HERO = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/documents/hero/DocumentsHero.astro'),
  'utf8'
);
const entry = getSolution('documents');
const view = solutionHeroView({ entry, ...DOCUMENTS_HERO });

describe('Documents hero', () => {
  it('renders the headline, eyebrow and a short lede', () => {
    expect(view.eyebrow).toBe('Solution · Documents');
    expect(view.title).toBe('Documents you can edit, read and export.');
    expect(view.headingId).toBe('solution-hero-documents');
    expect(wordCount(view.title)).toBeLessThanOrEqual(10);
    expect(wordCount(view.lede)).toBeLessThanOrEqual(30);
  });

  it('states the honest status from the registry, never in the copy', () => {
    expect(view.status).toBe('in development');
    expect(view.statusText).toBe('Status: in development');
    const copy = JSON.stringify(DOCUMENTS_HERO);
    expect(copy).not.toMatch(/\b(available|stable|production[- ]ready|1\.0)\b/i);
    expect(copy).not.toMatch(/PLAN_|plan 015|T-documents/i);
  });

  it('points every call to action at a real route', () => {
    expect(view.ctas.map((c) => c.kind)).toEqual(['primary', 'secondary']);
    for (const cta of DOCUMENTS_HERO.ctas) {
      if (cta.href.startsWith('#')) {
        expect(Object.values(SOLUTION_SECTION_IDS)).toContain(cta.href.slice(1));
      } else {
        const page = resolve(WEBSITE, 'src/pages', cta.href.replace(/^\/|\/$/g, ''), 'index.astro');
        expect(existsSync(page), cta.href).toBe(true);
      }
    }
    expect(DOCUMENTS_HERO.ctas[0]?.href).toBe(`#${SOLUTION_SECTION_IDS.demo}`);
  });

  it('uses the solution-documents-hero plate and paints texels until the slot is registered', () => {
    expect(DOCUMENTS_HERO.art).toBeUndefined();
    expect(view.art).toEqual({ slot: 'solution-documents-hero', variant: 'plate' });
    expect(typeof view.artRegistered).toBe('boolean');
    expect(view.artAlt.length).toBeGreaterThan(0);
  });

  it('composes the shared SolutionHero with the documents entry, statically', () => {
    expect(HERO).toContain("import SolutionHero from '../../shared/hero/SolutionHero.astro'");
    expect(HERO).toContain("getSolution('documents')");
    expect(HERO).toContain('<SolutionHero entry={entry} {...DOCUMENTS_HERO} />');
    expect(HERO).not.toMatch(/client:|set:html|\{@html|<script/);
  });
});

describe('Documents hero scope', () => {
  it('sends the secondary call to action to the quickstart and claims no planned feature', () => {
    expect(DOCUMENTS_HERO.ctas[1]?.href).toBe(`#${SOLUTION_SECTION_IDS.quickstart}`);
    const planned = entry.capabilities.filter((c) => c.status === 'planned');
    expect(planned.map((c) => c.id)).toContain('paged-editing');
    expect(JSON.stringify(DOCUMENTS_HERO)).not.toMatch(/paged[- ]view editing|edit .*paged/i);
  });
});
