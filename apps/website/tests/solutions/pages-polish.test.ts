import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILT_WITH_PAGE } from '../../src/components/built-with/index/index-content.ts';
import {
  PROTOYARD_PAGE,
  PROTOYARD_ROADMAP,
} from '../../src/components/built-with/protoyard/protoyard-content.ts';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { budgetFor, DEFAULT_BUDGET, islandBudgetFor } from '../../src/components/perf/budgets.ts';
import { NATIVE_HERO } from '../../src/components/sections/native/hero/hero-content.ts';
import { catalogCards } from '../../src/components/solutions/catalog/catalog-content.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(WEBSITE, path), 'utf8');

const catalog = read('src/components/solutions/catalog/SolutionsCatalog.astro');
const catalogPage = read('src/pages/solutions/index.astro');
const builtWith = read('src/components/built-with/index/BuiltWithIndex.astro');
const protoyard = read('src/components/built-with/protoyard/ProtoyardCaseStudy.astro');
const nativeHero = read('src/components/sections/native/hero/NativeHero.astro');
const nativePage = read('src/pages/native/index.astro');

describe('pages polish: home visual level, no new islands, no budget increases', () => {
  it('keeps catalog, Built with and Native island and size caps', () => {
    expect(islandBudgetFor('/solutions/')).toBe(0);
    expect(islandBudgetFor('/built-with/')).toBe(0);
    expect(islandBudgetFor('/built-with/protoyard/')).toBe(0);
    expect(islandBudgetFor('/native/')).toBe(1);
    expect(budgetFor('/solutions/').pageGzipKb).toBe(431);
    expect(budgetFor('/built-with/').pageGzipKb).toBe(221);
    expect(budgetFor('/built-with/protoyard/').pageGzipKb).toBe(203);
    expect(budgetFor('/native/').pageGzipKb).toBe(364);
    expect(budgetFor('/native/').htmlGzipKb).toBe(25.2);
    expect(DEFAULT_BUDGET.htmlGzipKb).toBe(24);
  });

  it('gives every catalog card its Solution hero plate and status', () => {
    const cards = catalogCards();
    expect(cards.map((card) => card.slug)).toEqual(SOLUTIONS.map((entry) => entry.slug));
    for (const card of cards) {
      expect(card.art).toBe(`solution-${card.slug}-hero`);
      if (card.slug !== 'design-systems')
        expect(illustrationFor(card.art)?.slot, card.art).toBe(card.art);
      const entry = SOLUTIONS.find((solution) => solution.slug === card.slug);
      expect(card.status).toBe(entry?.status);
    }
    expect(catalog).toContain('<SiteIllustration art={card.art} sizes={CARD_ART_SIZES} />');
    // Cards render about 22rem wide, so the browser picks a smaller derived width than a plate.
    expect(catalog).toContain(
      "const CARD_ART_SIZES = '(min-width: 64rem) 22rem, (min-width: 44rem) 46vw, 60vw';"
    );
    expect(catalog).toContain('<StatusBadge status={card.status} context={card.name} />');
    expect(catalog).toContain('<TexelMark count={3} />');
    expect(catalog).toContain('--home-ground');
    expect(catalog).toMatch(/clamp\(2\.75rem, 9vw, 5\.25rem\)/);
  });

  it('uses page-built-with and built-with-protoyard art, with Protoyard Cloud planned', () => {
    expect(BUILT_WITH_PAGE.hero.art).toBe('page-built-with');
    expect(illustrationFor('page-built-with')?.slot).toBe('page-built-with');
    expect(builtWith).toContain('<SiteIllustration art={page.hero.art} />');
    expect(builtWith).toContain('<TexelMark count={3} />');
    expect(PROTOYARD_PAGE.hero.art).toBe('built-with-protoyard');
    expect(illustrationFor('built-with-protoyard')?.slot).toBe('built-with-protoyard');
    expect(protoyard).toContain('<SiteIllustration art={page.hero.art} />');
    expect(
      PROTOYARD_ROADMAP.some(
        (item) => item.title === 'Protoyard Cloud' && item.status === 'planned'
      )
    ).toBe(true);
    expect(JSON.stringify({ BUILT_WITH_PAGE, PROTOYARD_PAGE })).not.toMatch(/Ronin/);
  });

  it('keeps the native-hero plate and the home rhythm, without extra islands', () => {
    expect(NATIVE_HERO.art.slot).toBe('native-hero');
    expect(illustrationFor('native-hero')?.slot).toBe('native-hero');
    expect(nativeHero).toContain('<SiteIllustration art={NATIVE_HERO.art.slot} />');
    expect(nativeHero).toContain('<TexelMark count={3} />');
    expect(nativeHero).toContain('--home-ground');
    expect(nativePage).toContain('<NativeDemo />');
    expect(islandBudgetFor('/native/')).toBe(1);
  });

  it('ships no new islands or HTML sinks on these pages', () => {
    for (const source of [catalog, catalogPage, builtWith, protoyard, nativeHero, nativePage]) {
      expect(source).not.toMatch(/set:html|\{@html|innerHTML/);
    }
    for (const source of [catalogPage, catalog, builtWith, protoyard]) {
      expect(source).not.toMatch(/client:[a-z]+/);
    }
  });
});
