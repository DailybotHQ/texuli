import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import {
  CANVAS_STORIES,
  CANVAS_STORY_EVIDENCE,
} from '../../src/components/solutions/canvas/stories/stories-content.ts';
import {
  storyArt,
  storyCapabilities,
} from '../../src/components/solutions/shared/story/story-model.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const ART_INDEX = resolve(
  REPO,
  '.dwp/plans/PLAN_015_ecosystem_solutions_native_site/analysis_results/art-prompts/INDEX.md'
);
const COMPONENT = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/canvas/stories/CanvasStories.astro'),
  'utf8'
);
const entry = getSolution('canvas');
const flat = (text: string): string => text.replace(/\s+/g, ' ');

describe('Canvas stories', () => {
  it('tells three to five stories with unique ids and real capability ids', () => {
    const { stories } = CANVAS_STORIES;
    expect(stories.length).toBeGreaterThanOrEqual(3);
    expect(stories.length).toBeLessThanOrEqual(5);
    expect(new Set(stories.map((s) => s.id)).size).toBe(stories.length);
    const ids = new Set(entry.capabilities.map((c) => c.id));
    for (const story of stories) {
      expect(story.capabilities.length, story.id).toBeGreaterThan(0);
      for (const id of story.capabilities) expect(ids.has(id), `${story.id}: ${id}`).toBe(true);
      expect(storyCapabilities(entry, story)).toHaveLength(story.capabilities.length);
    }
  });

  it('backs every claim with a file that contains its marker', () => {
    for (const story of CANVAS_STORIES.stories) {
      const claims = CANVAS_STORY_EVIDENCE[story.id] ?? [];
      expect(claims.length, story.id).toBeGreaterThan(0);
      for (const { claim, source, marker } of claims) {
        const path = resolve(REPO, source);
        expect(existsSync(path), `${claim}: ${source}`).toBe(true);
        expect(flat(readFileSync(path, 'utf8')), `${claim}: ${marker}`).toContain(marker);
      }
    }
    expect(Object.keys(CANVAS_STORY_EVIDENCE).sort()).toEqual(
      CANVAS_STORIES.stories.map((s) => s.id).sort()
    );
  });

  it('keeps the copy honest and inside a reading budget', () => {
    const copy = JSON.stringify(CANVAS_STORIES);
    expect(copy).not.toMatch(/\b(available|stable|production[- ]ready|1\.0)\b/i);
    expect(copy).not.toMatch(/PLAN_|T-canvas/);
    expect(copy).not.toMatch(/\d/);
    for (const story of CANVAS_STORIES.stories) {
      expect(story.body.split(/\s+/).length, story.id).toBeLessThanOrEqual(45);
      expect(story.status).toBeUndefined();
    }
  });

  it('reuses only registered art listed in the art index, otherwise the mosaic', () => {
    const index = existsSync(ART_INDEX) ? readFileSync(ART_INDEX, 'utf8') : undefined;
    for (const story of CANVAS_STORIES.stories) {
      if (!story.art) continue;
      expect(illustrationFor(story.art.slot), story.art.slot).toBeDefined();
      expect(storyArt(story, (slot) => illustrationFor(slot) !== undefined)).toEqual(story.art);
      if (index) expect(index).toContain(`\`${story.art.slot}.webp\``);
    }
  });

  it('composes the shared SolutionStories with the canvas entry, statically', () => {
    expect(COMPONENT).toContain(
      "import SolutionStories from '../../shared/story/SolutionStories.astro'"
    );
    expect(COMPONENT).toContain("getSolution('canvas')");
    expect(COMPONENT).toContain('<SolutionStories entry={entry} {...CANVAS_STORIES} />');
    expect(COMPONENT).not.toMatch(/client:|set:html|\{@html|<script/);
  });
});

describe('Canvas stories honesty', () => {
  it('never links the page it replaces or any route', () => {
    expect(JSON.stringify(CANVAS_STORIES)).not.toMatch(/canvas-page|href|https?:/);
  });
});
