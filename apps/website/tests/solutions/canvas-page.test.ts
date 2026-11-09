import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { twinNoteFor } from '../../src/components/docs/twin-notes.ts';
import { siteLlmsSections } from '../../src/components/seo/llms-site.ts';
import { checkLandingContent } from '../../src/components/solutions/shared/types.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';
import { CANVAS_ENTRY, CANVAS_LANDING } from '../../src/pages/solutions/canvas/_content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const PAGE = readFileSync(resolve(WEBSITE, 'src/pages/solutions/canvas/index.astro'), 'utf8');
const markup = PAGE.slice(PAGE.indexOf('---', 3) + 3);

describe('/solutions/canvas/', () => {
  it('is consistent with the Canvas registry entry and serves its routes', () => {
    expect(CANVAS_ENTRY.slug).toBe('canvas');
    expect(checkLandingContent(CANVAS_ENTRY, CANVAS_LANDING)).toEqual([]);
    const result = validateSolutionRegistry([CANVAS_ENTRY], { requireRoutes: true });
    expect(result.issues).toEqual([]);
  });

  it('composes every landing section through SolutionLayout, in order', () => {
    expect(markup).toContain('<SolutionLayout');
    const slots = [
      'hero',
      'demo',
      'stories',
      'how',
      'quickstart',
      'recipes',
      'agents',
      'platforms',
      'next',
    ];
    const positions = slots.map((slot) => {
      expect(markup, slot).toContain(`slot="${slot}"`);
      return markup.indexOf(`slot="${slot}"`);
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('hydrates only CanvasDemo when visible and includes a preview of the same fixture', () => {
    const islands = [...markup.matchAll(/<([\w.]+)[^>]*\bclient:(\w+)/g)].map(
      (match) => `${match[1]}:${match[2]}`
    );
    expect(islands).toEqual(['CanvasDemo:visible']);
    expect(markup).toContain('<CanvasPreview slot="preview" />');
    expect(CANVAS_ENTRY.demo.title).toBe('Sketch a launch plan');
  });

  it('sets page SEO and structured metadata from the registry facts', () => {
    expect(PAGE).toContain("const title = 'Canvas — an embeddable whiteboard'");
    expect(PAGE).toContain('const description = entry.tagline');
    expect(PAGE).toContain('jsonLd={techArticleJsonLd(title, description, entry.route)}');
    expect(markup).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(PAGE).not.toContain(CANVAS_ENTRY.replaces ?? '/canvas-page/');
    expect(CANVAS_ENTRY.links.some((link) => link.href === CANVAS_ENTRY.replaces)).toBe(false);
  });

  it('is discoverable in the Solutions llms section and carries a matching twin note', () => {
    const solutions = siteLlmsSections('https://texuli.com').find(
      (section) => section.name === 'Solutions'
    );
    expect(solutions?.links.map((link) => link.href)).toContain(
      'https://texuli.com/solutions/canvas/'
    );
    const note = twinNoteFor('/solutions/canvas/');
    expect(note?.operations).toContain('blueprint.validate');
    expect(note?.packages).toContain('canvas');
    expect(note?.links?.map((link) => link.href)).toContain('/guides/solutions/canvas/');
    expect(note?.demo).toContain(CANVAS_ENTRY.demo.title);
  });
});
