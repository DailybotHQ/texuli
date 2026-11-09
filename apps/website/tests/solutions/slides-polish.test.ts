import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { howArt, storyArtSlot } from '../../src/components/solutions/shared/art/art-slots.ts';
import { solutionHeroView } from '../../src/components/solutions/shared/hero/hero-model.ts';
import { nextStepsView } from '../../src/components/solutions/shared/resources/resources-model.ts';
import { storyArt } from '../../src/components/solutions/shared/story/story-model.ts';
import { SLIDES_NEXT } from '../../src/components/solutions/slides/extras/extras-content.ts';
import { SLIDES_HERO } from '../../src/components/solutions/slides/hero/hero-content.ts';
import { SLIDES_HOW } from '../../src/components/solutions/slides/how/how-content.ts';
import { SLIDES_STORIES } from '../../src/components/solutions/slides/stories/stories-content.ts';
import { SLIDES_ENTRY as entry } from '../../src/pages/solutions/slides/_content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const PAGE = readFileSync(resolve(WEBSITE, 'src/pages/solutions/slides/index.astro'), 'utf8');
const registered = (slot: string) => illustrationFor(slot) !== undefined;
const words = (text: string) => text.trim().split(/\s+/).length;

describe('Slides landing art', () => {
  it('gives the first three stories their own registered plates, in order', () => {
    const stories = SLIDES_STORIES.stories.slice(0, 3);
    expect(stories.map((story, index) => storyArtSlot(entry.slug, story, index))).toEqual([
      { slot: 'solution-slides-story-1', variant: 'plate' },
      { slot: 'solution-slides-story-2', variant: 'plate' },
      { slot: 'solution-slides-story-3', variant: 'plate' },
    ]);
    for (const story of stories) expect(story.art).toBeUndefined();
  });

  it('paints registered art on every story, never the unregistered mosaic', () => {
    SLIDES_STORIES.stories.forEach((story, index) => {
      const art = storyArtSlot(entry.slug, story, index);
      expect(illustrationFor(art.slot), `${story.id} → ${art.slot}`).toBeDefined();
      expect(storyArt({ art }, registered), story.id).toEqual(art);
    });
  });

  it('draws the how-it-works band from the registered solution-slides-how slot', () => {
    expect(SLIDES_HOW.art).toEqual({ slot: 'solution-slides-how', variant: 'band' });
    expect(howArt(entry.slug, SLIDES_HOW.art)).toEqual(SLIDES_HOW.art);
    expect(illustrationFor('solution-slides-how')?.variant).toBe('band');
  });

  it('keeps all art lazy and alt text from the registry', () => {
    for (const slot of [
      ...SLIDES_STORIES.stories.map((s, i) => storyArtSlot(entry.slug, s, i).slot),
      'solution-slides-how',
    ]) {
      const manifest = illustrationFor(slot);
      expect(manifest?.priority, slot).not.toBe(true);
      expect(manifest?.alt.trim().length, slot).toBeGreaterThan(10);
    }
  });
});

describe('Slides hero and closing calls to action', () => {
  it('has a short headline and lede, a primary demo action and a quickstart action', () => {
    const view = solutionHeroView({ entry, ...SLIDES_HERO });
    expect(words(view.title)).toBeLessThanOrEqual(10);
    expect(words(view.lede)).toBeLessThanOrEqual(30);
    expect(view.ctas.map((cta) => [cta.kind, cta.href])).toEqual([
      ['primary', '#demo'],
      ['secondary', '#quickstart'],
    ]);
    expect(view.status).toBe(entry.status);
    // Copy never states a status: SolutionHero prints it from the registry entry.
    expect(`${view.title} ${view.lede}`).not.toMatch(
      /\b(available|experimental|planned|stable)\b/i
    );
  });

  it('closes on the docs guide as the primary action and the package as the secondary', () => {
    const view = nextStepsView({ entry, ...SLIDES_NEXT });
    expect(view.links.map((link) => [link.kind, link.href])).toEqual([
      ['primary', entry.docs],
      ['secondary', 'https://www.npmjs.com/package/@texuli/slides'],
    ]);
    expect(view.links[0]?.label).toBe('Read the Slides guide');
  });

  it('sells an outcome in every story title and keeps bodies short', () => {
    for (const story of SLIDES_STORIES.stories) {
      expect(words(story.title), story.id).toBeLessThanOrEqual(8);
      expect(words(story.body), story.id).toBeLessThanOrEqual(45);
    }
    for (const step of SLIDES_HOW.steps)
      expect(words(step.body), step.title).toBeLessThanOrEqual(22);
  });

  it('keeps one island and no HTML sinks on the page', () => {
    const islands = [...PAGE.matchAll(/<(\w+)[^>]*\bclient:(\w+)/g)].map((m) => `${m[1]}:${m[2]}`);
    expect(islands).toEqual(['SlidesDemo:visible']);
    expect(PAGE).not.toMatch(/set:html|\{@html|innerHTML/);
  });
});
