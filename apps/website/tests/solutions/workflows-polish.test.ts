import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { wordCount } from '../../src/components/sections/home/home-content.ts';
import {
  howArt,
  isRegisteredSlot,
  storyArtSlot,
} from '../../src/components/solutions/shared/art/art-slots.ts';
import { solutionHeroView } from '../../src/components/solutions/shared/hero/hero-model.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import {
  WORKFLOWS_NEXT,
  WORKFLOWS_RECIPES,
} from '../../src/components/solutions/workflows/extras/extras-content.ts';
import { WORKFLOWS_HERO } from '../../src/components/solutions/workflows/hero/hero-content.ts';
import { WORKFLOWS_HOW } from '../../src/components/solutions/workflows/how/how-content.ts';
import { WORKFLOWS_STORIES } from '../../src/components/solutions/workflows/stories/stories-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const entry = getSolution('workflows');
const page = readFileSync(resolve(WEBSITE, 'src/pages/solutions/workflows/index.astro'), 'utf8');

const STORY_SLOTS = [
  'solution-workflows-story-1',
  'solution-workflows-story-2',
  'solution-workflows-story-3',
] as const;

const wordCountTrimmed = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

describe('Workflows landing polish', () => {
  it('assigns registered plate art to every story and registered band art to how it works', () => {
    expect(WORKFLOWS_STORIES.stories).toHaveLength(STORY_SLOTS.length);
    for (const [index, story] of WORKFLOWS_STORIES.stories.entries()) {
      const art = storyArtSlot(entry.slug, story, index);
      expect(art.slot).toBe(STORY_SLOTS[index]);
      expect(art.variant).toBe('plate');
      expect(isRegisteredSlot(art.slot)).toBe(true);
      expect(illustrationFor(art.slot)?.variant).toBe('plate');
    }

    const howSlot = WORKFLOWS_HOW.art;
    expect(howSlot).toEqual({ slot: 'solution-workflows-how', variant: 'band' });
    expect(howArt(entry.slug, howSlot)).toEqual(howSlot);
    expect(illustrationFor(howSlot?.slot ?? '')?.variant).toBe('band');
  });

  it('keeps a concise hero and the two calls to action on their real landing sections', () => {
    const view = solutionHeroView({ entry, ...WORKFLOWS_HERO });
    expect(view.title).toBe('Workflow graphs you can draw, check and embed.');
    expect(wordCount(view.title)).toBeLessThanOrEqual(10);
    expect(wordCountTrimmed(view.lede)).toBeLessThanOrEqual(30);
    expect(view.statusText).toBe('Status: in development');
    expect(view.ctas).toEqual([
      {
        kind: 'primary',
        label: 'Edit the approval flow',
        href: `#${SOLUTION_SECTION_IDS.demo}`,
      },
      {
        kind: 'secondary',
        label: 'Start building',
        href: `#${SOLUTION_SECTION_IDS.quickstart}`,
      },
    ]);
    expect(JSON.stringify(WORKFLOWS_HERO)).not.toMatch(/PLAN_|T-workflows|production[- ]ready/i);
  });

  it('closes on a direct build action without adding an unsupported route', () => {
    expect(WORKFLOWS_NEXT.links[0]).toEqual({
      label: 'Build your first workflow graph',
      href: entry.docs,
    });
    expect(WORKFLOWS_RECIPES.recipes.map((recipe) => recipe.href)).toEqual([
      entry.docs,
      '/workflows-page/json/',
      'https://www.npmjs.com/package/@texuli/workflows',
    ]);
  });

  it('keeps the Workflow demo as the landing’s only island', () => {
    const markup = page.slice(page.indexOf('---', 3) + 3);
    const islands = [...markup.matchAll(/client:[a-z]+/g)].map((match) => match[0]);
    expect(islands).toEqual(['client:visible']);
    expect(page).toContain('<WorkflowPreview slot="preview" />');
    expect(page).toContain('<WorkflowsDemo slot="demo" client:visible />');
  });
});
