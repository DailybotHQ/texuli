import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import {
  chipStatus,
  mosaicTones,
  storyArt,
  storyCapabilities,
  storyIds,
  storySide,
  storyStatus,
} from '../../src/components/solutions/shared/story/story-model.ts';
import {
  checkLandingContent,
  type SolutionLandingContent,
  type SolutionStory,
} from '../../src/components/solutions/shared/types.ts';
import { getSolution, SOLUTIONS } from '../../src/data/solutions/index.ts';
import type { SolutionEntry } from '../../src/data/solutions/schema.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const source = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/shared/story/SolutionStories.astro'),
  'utf8'
);
const markup = source.slice(source.lastIndexOf('---') + 3, source.indexOf('<style>'));
const styles = source.slice(source.indexOf('<style>'));

// A model fixture with mixed statuses; the real registry entries are used below as well.
const entry: SolutionEntry = {
  ...getSolution('slides'),
  status: 'available',
  capabilities: [
    { id: 'present', title: 'Present', summary: 'Step through slides.', status: 'available' },
    { id: 'export', title: 'Export', summary: 'Print and PPTX.', status: 'planned' },
    { id: 'notes', title: 'Speaker notes', summary: 'Notes view.', status: 'planned' },
  ],
};

const story = (over: Partial<SolutionStory>): SolutionStory => ({
  id: 's',
  title: 'T',
  body: 'B',
  capabilities: [],
  ...over,
});

describe('story composition model', () => {
  it('alternates the art side, starting at the inline end', () => {
    expect([0, 1, 2, 3].map(storySide)).toEqual(['end', 'start', 'end', 'start']);
  });

  it('resolves capability chips from the entry in story order, dropping unknown and repeated ids', () => {
    const chips = storyCapabilities(
      entry,
      story({ capabilities: ['export', 'nope', 'present', 'export'] })
    );
    expect(chips.map((c) => c.title)).toEqual(['Export', 'Present']);
  });

  it('badges a story by its own status, or by a shared capability status that differs from the Solution', () => {
    const planned = storyCapabilities(entry, story({ capabilities: ['export', 'notes'] }));
    const mixed = storyCapabilities(entry, story({ capabilities: ['present', 'export'] }));
    const same = storyCapabilities(entry, story({ capabilities: ['present'] }));
    expect(storyStatus(entry, story({}), planned)).toBe('planned');
    expect(storyStatus(entry, story({}), mixed)).toBeUndefined();
    expect(storyStatus(entry, story({}), same)).toBeUndefined();
    expect(storyStatus(entry, story({ status: 'experimental' }), same)).toBe('experimental');
    const [present, exported] = mixed;
    if (!present || !exported) throw new Error('fixture');
    expect(chipStatus(present, 'available')).toBeUndefined();
    expect(chipStatus(exported, 'available')).toBe('planned');
  });

  it('paints a registered art slot, or the mosaic for a missing or unregistered one', () => {
    const registered = (slot: string) => slot === 'known';
    expect(storyArt(story({ art: { slot: 'known', variant: 'plate' } }), registered)).toEqual({
      slot: 'known',
      variant: 'plate',
    });
    expect(
      storyArt(story({ art: { slot: 'unknown', variant: 'plate' } }), registered)
    ).toBeUndefined();
    expect(storyArt(story({}), registered)).toBeUndefined();
    expect(
      storyArt(
        story({ art: { slot: 'home-pieces', variant: 'plate' } }),
        (s) => illustrationFor(s) !== undefined
      )
    ).toBeDefined();
    const tones = mosaicTones('slides:present');
    expect(tones).toEqual(mosaicTones('slides:present'));
    expect(tones).not.toEqual(mosaicTones('slides:export'));
    expect(tones.every((t) => t >= 0 && t <= 4)).toBe(true);
  });

  it('gives every heading a unique id per Solution', () => {
    const ids = storyIds('slides', [{ id: 'a' }, { id: 'b' }]);
    expect(new Set([ids.section, ...ids.story]).size).toBe(3);
    expect(ids.story[0]).toBe('solution-slides-story-a');
  });

  it('works with every registry entry: stories naming its capabilities pass checkLandingContent', () => {
    for (const solution of SOLUTIONS) {
      const stories = solution.capabilities.map((cap, i) =>
        story({ id: `s${i}`, title: cap.title, body: cap.summary, capabilities: [cap.id] })
      );
      const content: SolutionLandingContent = {
        hero: {
          eyebrow: 'Solution',
          title: solution.name,
          lede: solution.tagline,
          ctas: [{ kind: 'primary', label: 'Try the demo', href: '#demo' }],
        },
        demo: { title: 'Try it', tryThis: ['Use the keyboard'], label: `${solution.name} demo` },
        stories: { title: 'What it does', stories },
        how: { title: 'How it works', steps: [] },
        quickstart: {
          title: 'Quickstart',
          install: { label: 'Install', language: 'bash', code: 'pnpm add texuli' },
          samples: [],
          verifiedBy: 'a test',
        },
        agents: { title: 'Agents', body: 'Agents.', surfaces: [] },
        platforms: { title: 'Platforms' },
        next: { links: [{ label: 'Docs', href: solution.docs }] },
      };
      expect(checkLandingContent(solution, content), solution.slug).toEqual([]);
      for (const [i, s] of stories.entries())
        expect(
          storyCapabilities(solution, s).map((c) => c.id),
          `${solution.slug} ${i}`
        ).toEqual(s.capabilities);
    }
  });
});

describe('SolutionStories markup', () => {
  it('takes the contract props and renders an h2 section with one h3 article per story', () => {
    expect(source).toContain('type Props = SolutionStoriesProps;');
    expect(markup).toContain('aria-labelledby={ids.section}');
    expect((markup.match(/<h2\b/g) ?? []).length).toBe(1);
    expect((markup.match(/<h3\b/g) ?? []).length).toBe(1);
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup).toMatch(/<article[\s\S]*?aria-labelledby=\{band\.id\}/);
  });

  it('alternates art and copy with logical CSS, copy first in source order', () => {
    expect(markup).toMatch(/`solution-story--art-\$\{band\.side\}`/);
    expect(markup.indexOf('solution-story__copy')).toBeLessThan(
      markup.indexOf('solution-story__art')
    );
    expect(styles).toMatch(/\.solution-story--art-start \.solution-story__art \{\s*order: -1;/);
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });

  it('uses SiteIllustration for registered art and a decorative mosaic otherwise', () => {
    expect(markup).toContain('<SiteIllustration art={band.art.slot} />');
    expect(markup).toMatch(/class="solution-story__mosaic" aria-hidden="true"/);
    expect(source).toContain('illustrationFor(slot) !== undefined');
  });

  it('is static and safe: no script, island, HTML sink, inline style or link to a route', () => {
    expect(markup).not.toMatch(/client:[a-z]+/);
    expect(source).not.toMatch(/<script\b/);
    expect(source).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(markup).not.toMatch(/<a\b/);
    expect(styles).not.toMatch(/\.solution-stories\s*\{[^}]*background:/);
  });
});
