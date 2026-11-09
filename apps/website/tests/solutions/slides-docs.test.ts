import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { loadSlidesDocs, SLIDES_DOC_FILES } from '../../src/content/solution-docs/slides/index.ts';
import { parseDocMarkdown } from '../../src/content/solution-docs/slides/parse.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const CONTENT = resolve(WEBSITE, 'src/content/solution-docs/slides');
const PAGE = resolve(WEBSITE, 'src/pages/guides/solutions/slides/index.astro');
const page = readFileSync(PAGE, 'utf8');
const slides = getSolution('slides');
const sections = loadSlidesDocs();
const corpus = sections.map((section) => section.source).join('\n');

describe('Slides solution docs', () => {
  it('ships the seven Markdown files and the guides route page', () => {
    expect([...SLIDES_DOC_FILES]).toEqual([
      'overview',
      'quickstart',
      'model',
      'integration',
      'a11y',
      'limits',
      'agents',
    ]);
    for (const id of SLIDES_DOC_FILES) {
      expect(existsSync(join(CONTENT, `${id}.md`)), id).toBe(true);
    }
    expect(existsSync(PAGE)).toBe(true);
    expect(siteRouteExists('/guides/solutions/slides/')).toBe(true);
    expect(slides.docs).toBe('/guides/solutions/slides/');
  });

  it('links both ways with the landing: docs back-link and registry docs href', () => {
    expect(slides.route).toBe('/solutions/slides/');
    expect(slides.links.some((link) => link.href === slides.docs)).toBe(true);
    expect(page).toContain('SolutionDocsLayout');
    expect(page).toContain("getSolution('slides')");
    expect(page).toContain('{entry}');
    expect(page).toContain('loadSlidesDocs');
    expect(page).toContain('data-slides-doc');
  });

  it('loads real APIs, in-development status, and no HTML sink or plan name', () => {
    expect(corpus).toMatch(/in development/i);
    expect(corpus).toContain('parseDeck');
    expect(corpus).toContain('@texuli/deck/model');
    expect(corpus).toContain('DeckStage');
    expect(corpus).toContain('@texuli/slides/stage');
    expect(corpus).toContain('createDeckController');
    expect(corpus).toContain('loadUntrustedDeck');
    expect(corpus).toContain('parseDeckMarkdown');
    expect(page).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(page).not.toMatch(/client:[a-z]+/);
    expect(`${page}\n${corpus}`).not.toMatch(/PLAN_015/);
    const heading = parseDocMarkdown('## Hello world\n\nA `code` word.\n').find(
      (block) => block.type === 'h2'
    );
    expect(heading).toMatchObject({ type: 'h2', id: 'hello-world', text: 'Hello world' });
    expect(sections.every((section) => section.blocks.some((block) => block.type === 'h2'))).toBe(
      true
    );
  });
});
