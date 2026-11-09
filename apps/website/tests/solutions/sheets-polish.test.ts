import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { budgetFor, islandBudgetFor } from '../../src/components/perf/budgets.ts';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import {
  howArt,
  isRegisteredSlot,
  storyArtSlot,
} from '../../src/components/solutions/shared/art/art-slots.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import { checkLandingContent } from '../../src/components/solutions/shared/types.ts';
import { SHEETS_NEXT } from '../../src/components/solutions/sheets/extras/extras-content.ts';
import { SHEETS_HERO } from '../../src/components/solutions/sheets/hero/hero-content.ts';
import { SHEETS_HOW } from '../../src/components/solutions/sheets/how/how-content.ts';
import { SHEETS_STORIES } from '../../src/components/solutions/sheets/stories/stories-content.ts';
import { SHEETS_ENTRY, SHEETS_LANDING } from '../../src/pages/solutions/sheets/_content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const PAGE = readFileSync(resolve(WEBSITE, 'src/pages/solutions/sheets/index.astro'), 'utf8');
const markup = PAGE.slice(PAGE.indexOf('---', 3) + 3);

describe('Sheets polish', () => {
  it('sets registered art on the first three stories and the how-it-works band', () => {
    const first = SHEETS_STORIES.stories.slice(0, 3);
    expect(first.map((story, index) => storyArtSlot('sheets', story, index))).toEqual([
      { slot: 'solution-sheets-story-1', variant: 'plate' },
      { slot: 'solution-sheets-story-2', variant: 'plate' },
      { slot: 'solution-sheets-story-3', variant: 'plate' },
    ]);
    for (const [index, story] of first.entries()) {
      expect(story.art?.slot, story.id).toBe(`solution-sheets-story-${index + 1}`);
      expect(story.art?.variant, story.id).toBe('plate');
      expect(isRegisteredSlot(story.art?.slot ?? ''), story.id).toBe(true);
      expect(illustrationFor(story.art?.slot ?? '')?.variant, story.id).toBe('plate');
    }
    expect(SHEETS_STORIES.stories[3]?.art).toBeUndefined();

    expect(SHEETS_HOW.art).toEqual({ slot: 'solution-sheets-how', variant: 'band' });
    expect(howArt('sheets', SHEETS_HOW.art)?.slot).toBe('solution-sheets-how');
    expect(isRegisteredSlot('solution-sheets-how')).toBe(true);
    expect(illustrationFor('solution-sheets-how')?.variant).toBe('band');
  });

  it('keeps the hero and next-step CTA contract', () => {
    expect(checkLandingContent(SHEETS_ENTRY, SHEETS_LANDING)).toEqual([]);
    expect(SHEETS_HERO.ctas.map((cta) => cta.kind)).toEqual(['primary', 'secondary']);
    expect(SHEETS_HERO.ctas[0]?.href).toBe(`#${SOLUTION_SECTION_IDS.demo}`);
    expect(SHEETS_HERO.ctas[1]?.href).toBe(`#${SOLUTION_SECTION_IDS.quickstart}`);
    expect(wordCount(SHEETS_HERO.title)).toBeLessThanOrEqual(10);
    expect(wordCount(SHEETS_HERO.lede)).toBeLessThanOrEqual(30);
    expect(SHEETS_NEXT.links[0]?.href).toBe(SHEETS_ENTRY.docs);
    const copy = JSON.stringify({ SHEETS_HERO, SHEETS_STORIES, SHEETS_HOW, SHEETS_NEXT });
    expect(copy).not.toMatch(/\b(available|stable|production[- ]ready)\b/i);
    expect(copy).not.toMatch(/PLAN_|T-sheets|sheets-page/);
  });

  it('keeps one island, no sinks, and the inherited route budgets', () => {
    const islands = [...markup.matchAll(/<(\w+)[^>]*\bclient:(\w+)/g)].map(
      (match) => `${match[1]}:${match[2]}`
    );
    expect(islands).toEqual(['SheetsDemo:visible']);
    expect(PAGE).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(islandBudgetFor('/solutions/sheets/')).toBe(1);
    expect(budgetFor('/solutions/sheets/').pageGzipKb).toBe(186);
    expect(budgetFor('/solutions/sheets/').htmlGzipKb).toBe(31);
  });
});
