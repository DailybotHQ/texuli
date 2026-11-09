import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import { CANVAS_NEXT } from '../../src/components/solutions/canvas/extras/extras-content.ts';
import { CANVAS_HERO } from '../../src/components/solutions/canvas/hero/hero-content.ts';
import { CANVAS_HOW } from '../../src/components/solutions/canvas/how/how-content.ts';
import { CANVAS_STORIES } from '../../src/components/solutions/canvas/stories/stories-content.ts';
import { nextStepsView } from '../../src/components/solutions/shared/resources/resources-model.ts';
import { SOLUTION_SECTION_IDS } from '../../src/components/solutions/shared/subnav/sections.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const entry = getSolution('canvas');

describe('Canvas landing polish', () => {
  it('wires each of the first three stories to its registered plate art', () => {
    const stories = CANVAS_STORIES.stories.slice(0, 3);
    expect(stories.map((story) => story.art)).toEqual(
      [1, 2, 3].map((index) => ({ slot: `solution-canvas-story-${index}`, variant: 'plate' }))
    );
    for (const story of stories) {
      expect(illustrationFor(story.art!.slot)?.variant).toBe('plate');
    }
  });

  it('wires the how-it-works section to its registered band art', () => {
    expect(CANVAS_HOW.art).toEqual({ slot: 'solution-canvas-how', variant: 'band' });
    expect(illustrationFor(CANVAS_HOW.art?.slot ?? '')?.variant).toBe('band');
  });

  it('keeps a concise, honest hero with calls to action on this landing', () => {
    expect(CANVAS_HERO.title.trim().length).toBeGreaterThan(0);
    expect(CANVAS_HERO.title.trim().split(/\s+/)).toHaveLength(6);
    expect(CANVAS_HERO.lede.trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    expect(CANVAS_HERO.lede).toContain('Your app owns');
    expect(CANVAS_HERO.ctas.map(({ kind }) => kind)).toEqual(['primary', 'secondary']);
    expect(CANVAS_HERO.ctas.map(({ href }) => href)).toEqual([
      `#${SOLUTION_SECTION_IDS.demo}`,
      `#${SOLUTION_SECTION_IDS.quickstart}`,
    ]);
    expect(JSON.stringify(CANVAS_HERO)).not.toMatch(/PLAN_|production[- ]ready|stable/i);
  });

  it('closes with the Canvas docs as a clear primary build action', () => {
    const view = nextStepsView({ entry, ...CANVAS_NEXT });
    expect(view.title).toBe('Start building with Canvas');
    expect(view.links[0]).toMatchObject({
      label: 'Build with the Canvas API',
      href: '/guides/solutions/canvas/',
      kind: 'primary',
    });
    expect(JSON.stringify(CANVAS_NEXT)).not.toMatch(/PLAN_|canvas-page/);
  });
});
