import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DRAG_PIECES, DRAG_SECTIONS } from '../../src/components/drag-site/page.ts';

const read = (path: string) => readFileSync(resolve(path), 'utf8');
const PAGE = read('apps/website/src/pages/drag-page/index.astro');
const COPY = PAGE.replace(/\s+/g, ' ');
const DRAG_PACKAGE = JSON.parse(read('packages/drag/package.json')) as {
  name: string;
  version: string;
};

describe('Drag capability page', () => {
  it('keeps the canonical route and classifies the engine as a capability', () => {
    expect(PAGE).toContain('/drag-page/');
    expect(PAGE).toContain('Capability · cross-cutting engine');
    expect(COPY).toContain('an embeddable interaction engine, not a hosted drag-and-drop product');
    expect(COPY).toContain(
      'returns validated moves as data; your application applies them and owns state, history and permissions'
    );
    expect(PAGE).not.toContain('/capabilities/drag-and-drop/');
    expect(PAGE).not.toContain('PLAN_');
  });

  it('states the package status honestly and keeps the real demo sections', () => {
    expect(DRAG_PACKAGE).toMatchObject({ name: '@texuli/drag', version: '0.16.1' });
    expect(PAGE).toContain('@texuli/drag · in development');
    expect(PAGE).toContain('a pre-1.0 release');
    expect(DRAG_SECTIONS.map(({ id }) => id)).toEqual([
      'lists',
      'groups',
      'canvas',
      'grid-columns',
      'file-drop',
      'contract',
    ]);
    expect(DRAG_PIECES.map(({ name }) => name)).toEqual([
      'session',
      'sortable',
      'collision',
      'modifiers',
      'gesture',
      'auto-scroll',
      'spatial',
      'graph',
      'messages',
    ]);
    expect(DRAG_SECTIONS.find(({ id }) => id === 'file-drop')?.summary).toContain(
      'not @texuli/drag'
    );
  });

  it('links the shipped Solution landings, never the *-page routes they replace', () => {
    for (const slug of ['canvas', 'workflows', 'slides']) {
      expect(PAGE).toContain(`href="/solutions/${slug}/"`);
      expect(PAGE).not.toContain(`href="/${slug}-page/"`);
    }
  });

  it('keeps every demo island lazy and the page sink-free', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.length).toBeGreaterThan(0);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    expect(PAGE).not.toMatch(/\{@html|set:html|innerHTML|srcdoc/);
  });
});
