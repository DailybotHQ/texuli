// @vitest-environment node
/**
 * The Documents landing at the home's level: every story and the how-it-works band resolve
 * to a registered art slot (the texel mosaic paints until the WebP lands), the stories follow
 * the order of their art, the hero and the closing band keep their call-to-action contract,
 * and the page keeps one island and no HTML sinks.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { DOCUMENTS_NEXT } from '../../src/components/solutions/documents/extras/extras-content.ts';
import { DOCUMENTS_HERO } from '../../src/components/solutions/documents/hero/hero-content.ts';
import { DOCUMENTS_HOW } from '../../src/components/solutions/documents/how/how-content.ts';
import { DOCUMENTS_STORIES } from '../../src/components/solutions/documents/stories/stories-content.ts';
import {
  howArt,
  isRegisteredSlot,
  storyArtSlot,
} from '../../src/components/solutions/shared/art/art-slots.ts';
import { nextStepsView } from '../../src/components/solutions/shared/resources/resources-model.ts';
import { storyArt } from '../../src/components/solutions/shared/story/story-model.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const entry = getSolution('documents');
const words = (text: string) => text.trim().split(/\s+/).length;

describe('Documents landing art', () => {
  it('gives every story a registered art slot, in the order of the story art', () => {
    const { stories } = DOCUMENTS_STORIES;
    expect(stories.map((s) => s.id)).toEqual(['edit', 'read', 'export']);
    stories.forEach((story, index) => {
      const slot = storyArtSlot(entry.slug, story, index);
      expect(slot).toEqual({ slot: `solution-documents-story-${index + 1}`, variant: 'plate' });
      expect(isRegisteredSlot(slot.slot), slot.slot).toBe(true);
      // The block shows the slot itself, never the mosaic-only fallback.
      expect(storyArt({ art: slot }, isRegisteredSlot)).toEqual(slot);
      expect(illustrationFor(slot.slot)?.variant).toBe('plate');
    });
    // Each story's art shows what the story says.
    const alt = (n: number) => illustrationFor(`solution-documents-story-${n}`)?.alt ?? '';
    expect(alt(1)).toMatch(/slash-menu/);
    expect(alt(2)).toMatch(/outline/);
    expect(alt(3)).toMatch(/export/);
  });

  it('renders the how-it-works art band from its registered slot', () => {
    expect(DOCUMENTS_HOW.art).toEqual({ slot: 'solution-documents-how', variant: 'band' });
    expect(howArt(entry.slug, DOCUMENTS_HOW.art)).toEqual(DOCUMENTS_HOW.art);
    expect(illustrationFor('solution-documents-how')?.variant).toBe('band');
  });

  it('tells collaboration in the last how step, transport left to the host app', () => {
    const last = DOCUMENTS_HOW.steps.at(-1);
    expect(last?.body).toMatch(/comments, suggestions and version history/);
    expect(last?.body).toMatch(/Your app supplies the transport\./);
    const pages = readFileSync(resolve(WEBSITE, '../../packages/pages/README.md'), 'utf8');
    for (const marker of [
      'comments anchored to the text',
      'suggestions with accept and reject',
      'version history with restore',
    ])
      expect(pages).toContain(marker);
  });
});

describe('Documents hero and closing contract', () => {
  it('opens with a short headline, a tight lede and two in-page calls to action', () => {
    expect(words(DOCUMENTS_HERO.title)).toBeLessThanOrEqual(10);
    expect(words(DOCUMENTS_HERO.lede)).toBeLessThanOrEqual(30);
    expect(DOCUMENTS_HERO.lede).toMatch(/Markdown, DOCX and PDF/);
    expect(DOCUMENTS_HERO.ctas).toEqual([
      { kind: 'primary', label: 'Edit the live report', href: `#${SOLUTION_SECTION_IDS.demo}` },
      { kind: 'secondary', label: 'Get started', href: `#${SOLUTION_SECTION_IDS.quickstart}` },
    ]);
  });

  it('closes on the guide, then back to the demo, then the package', () => {
    const view = nextStepsView({ entry, ...DOCUMENTS_NEXT });
    expect(view.links.map((l) => [l.kind, l.href])).toEqual([
      ['primary', '/guides/solutions/documents/'],
      ['secondary', `#${SOLUTION_SECTION_IDS.demo}`],
      ['text', 'https://www.npmjs.com/package/@texuli/pages'],
    ]);
  });

  it('keeps every headline short, the statuses honest and the plan out of the copy', () => {
    for (const story of DOCUMENTS_STORIES.stories)
      expect(words(story.title), story.id).toBeLessThanOrEqual(10);
    for (const step of DOCUMENTS_HOW.steps)
      expect(words(step.body), step.title).toBeLessThanOrEqual(25);
    const copy = JSON.stringify([DOCUMENTS_HERO, DOCUMENTS_STORIES, DOCUMENTS_HOW, DOCUMENTS_NEXT]);
    expect(copy).not.toMatch(/\b(available|stable|production[- ]ready)\b/i);
    expect(copy).not.toMatch(/PLAN_|plan 015|T-documents|documents-page/i);
    expect(copy).not.toMatch(/paged[- ]view editing (is )?(ready|done)|hosted|cloud/i);
  });

  it('keeps one island and no HTML sinks on the page', () => {
    const page = readFileSync(
      resolve(WEBSITE, 'src/pages/solutions/documents/index.astro'),
      'utf8'
    );
    const markup = page.slice(page.indexOf('---', 3) + 3);
    expect(markup.match(/client:[a-z]+/g)).toEqual(['client:visible']);
    expect(page).toContain('<DocumentsDemo slot="demo" client:visible />');
    expect(page).not.toMatch(/set:html|\{@html|innerHTML/);
  });
});
