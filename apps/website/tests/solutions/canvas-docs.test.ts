import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { CANVAS_DOC_FILES, loadCanvasDocs } from '../../src/content/solution-docs/canvas/index.ts';
import { parseDocMarkdown } from '../../src/content/solution-docs/parse.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const CONTENT = resolve(WEBSITE, 'src/content/solution-docs/canvas');
const PAGE = resolve(WEBSITE, 'src/pages/guides/solutions/canvas/index.astro');
const page = readFileSync(PAGE, 'utf8');
const canvas = getSolution('canvas');
const sections = loadCanvasDocs();
const corpus = sections.map((section) => section.source).join('\n');

describe('Canvas solution docs', () => {
  it('ships the seven Markdown files and the guides route page', () => {
    expect([...CANVAS_DOC_FILES]).toEqual([
      'overview',
      'quickstart',
      'model',
      'integration',
      'a11y',
      'limits',
      'agents',
    ]);
    for (const id of CANVAS_DOC_FILES) {
      expect(existsSync(join(CONTENT, `${id}.md`)), id).toBe(true);
    }
    expect(existsSync(PAGE)).toBe(true);
    expect(siteRouteExists('/guides/solutions/canvas/')).toBe(true);
    expect(canvas.docs).toBe('/guides/solutions/canvas/');
  });

  it('links both ways with the landing: docs back-link and registry docs href', () => {
    expect(canvas.route).toBe('/solutions/canvas/');
    expect(canvas.links.some((link) => link.href === canvas.docs)).toBe(true);
    expect(page).toContain('SolutionDocsPage');
    expect(page).toContain("getSolution('canvas')");
    expect(page).toContain('loadCanvasDocs');
    expect(page).toContain('../../../../components/');
    expect(corpus).not.toMatch(/canvas-page/);
    expect(page).not.toMatch(/canvas-page/);
  });

  it('loads real APIs, in-development status, and no HTML sink or plan name', () => {
    expect(corpus).toMatch(/in development/i);
    expect(corpus).toContain('createCanvas');
    expect(corpus).toContain('applyCanvasOps');
    expect(corpus).toContain('loadUntrustedCanvas');
    expect(corpus).toContain('@texuli/canvas/model');
    expect(corpus).toContain('CanvasEditor');
    expect(corpus).toContain('@texuli/canvas/editor');
    expect(corpus).toContain('canvasToSvg');
    expect(corpus).toContain('createCanvasPlayerHost');
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
