import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { twinNoteFor } from '../../src/components/docs/twin-notes.ts';
import { siteLlmsSections } from '../../src/components/seo/llms-site.ts';
import { checkLandingContent } from '../../src/components/solutions/shared/types.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';
import { SLIDES_ENTRY, SLIDES_LANDING } from '../../src/pages/solutions/slides/_content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const PAGE = readFileSync(resolve(WEBSITE, 'src/pages/solutions/slides/index.astro'), 'utf8');
const markup = PAGE.slice(PAGE.indexOf('---', 3) + 3);

describe('/solutions/slides/ (the Solution landing pilot)', () => {
  it('is consistent with its registry entry', () => {
    expect(SLIDES_ENTRY.slug).toBe('slides');
    expect(checkLandingContent(SLIDES_ENTRY, SLIDES_LANDING)).toEqual([]);
  });

  it('ships the landing and docs routes the registry names', () => {
    const result = validateSolutionRegistry([SLIDES_ENTRY], { requireRoutes: true });
    expect(result.issues).toEqual([]);
  });

  it('composes every section through SolutionLayout, in its slots', () => {
    expect(markup).toContain('<SolutionLayout');
    for (const slot of [
      'hero',
      'demo',
      'stories',
      'how',
      'quickstart',
      'recipes',
      'agents',
      'platforms',
      'next',
    ]) {
      expect(markup, slot).toMatch(new RegExp(`slot="${slot}"`));
    }
  });

  it('hydrates exactly one island, the Slides demo, when visible, with an SSR preview', () => {
    const islands = [...markup.matchAll(/<(\w+)[^>]*\bclient:(\w+)/g)].map(
      (m) => `${m[1]}:${m[2]}`
    );
    expect(islands).toEqual(['SlidesDemo:visible']);
    expect(markup).toContain('<SlidesDemoPreview slot="preview" />');
  });

  it('has no HTML sinks and never links the route it replaces', () => {
    expect(PAGE).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(PAGE).not.toContain(SLIDES_ENTRY.replaces ?? '/slides-page/');
  });

  it('is described for agents: llms.txt section and a Markdown twin note', () => {
    const solutions = siteLlmsSections('https://texuli.com').find((s) => s.name === 'Solutions');
    expect(solutions?.links.map((l) => l.href)).toContain('https://texuli.com/solutions/slides/');
    const note = twinNoteFor('/solutions/slides/');
    expect(note?.operations).toContain('deck.run');
    expect(note?.links?.map((l) => l.href)).toContain('/guides/solutions/slides/');
  });
});
