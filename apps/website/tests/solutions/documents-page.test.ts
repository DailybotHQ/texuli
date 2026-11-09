import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { twinNoteFor } from '../../src/components/docs/twin-notes.ts';
import { siteLlmsSections } from '../../src/components/seo/llms-site.ts';
import { checkLandingContent } from '../../src/components/solutions/shared/types.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';
import {
  DOCUMENTS_ENTRY,
  DOCUMENTS_LANDING,
} from '../../src/pages/solutions/documents/_content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const PAGE = readFileSync(resolve(WEBSITE, 'src/pages/solutions/documents/index.astro'), 'utf8');
const markup = PAGE.slice(PAGE.indexOf('---', 3) + 3);

describe('/solutions/documents/ (the Documents Solution landing)', () => {
  it('is consistent with its registry entry', () => {
    expect(DOCUMENTS_ENTRY.slug).toBe('documents');
    expect(checkLandingContent(DOCUMENTS_ENTRY, DOCUMENTS_LANDING)).toEqual([]);
  });

  it('ships the landing and docs routes the registry names', () => {
    const result = validateSolutionRegistry([DOCUMENTS_ENTRY], { requireRoutes: true });
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

  it('hydrates exactly one island, the Documents demo, when visible, with an SSR preview', () => {
    const islands = [...markup.matchAll(/<(\w+)[^>]*\bclient:(\w+)/g)].map(
      (m) => `${m[1]}:${m[2]}`
    );
    expect(islands).toEqual(['DocumentsDemo:visible']);
    expect(markup).toContain('<DocumentsDemoPreview slot="preview" />');
  });

  it('has no HTML sinks and never links the route it replaces', () => {
    expect(PAGE).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(PAGE).not.toContain(DOCUMENTS_ENTRY.replaces ?? '/documents-page/');
  });

  it('is described for agents: llms.txt section and a Markdown twin note', () => {
    const solutions = siteLlmsSections('https://texuli.com').find((s) => s.name === 'Solutions');
    expect(solutions?.links.map((l) => l.href)).toContain(
      'https://texuli.com/solutions/documents/'
    );
    const note = twinNoteFor('/solutions/documents/');
    expect(note?.operations).toContain('document.run');
    expect(note?.links?.map((l) => l.href)).toContain('/guides/solutions/documents/');
  });
});

describe('/solutions/documents/ links and facts', () => {
  it('links nothing to /documents-page/, from the page, its content or the registry', () => {
    const facts = JSON.stringify({ DOCUMENTS_ENTRY, DOCUMENTS_LANDING });
    expect(facts.replace(/"replaces":"\/documents-page\/"/, '')).not.toContain('/documents-page/');
    expect(DOCUMENTS_ENTRY.replaces).toBe('/documents-page/');
  });

  it('keeps the twin facts equal to the registry: status, packages and the docs link', () => {
    const note = twinNoteFor('/solutions/documents/');
    expect(note?.packages).toEqual(['document', 'pages', 'editor']);
    const solutions = siteLlmsSections('https://texuli.com').find((s) => s.name === 'Solutions');
    const link = solutions?.links.find((l) => l.href === 'https://texuli.com/solutions/documents/');
    expect(link?.description).toContain(`Status: ${DOCUMENTS_ENTRY.status}.`);
    expect(DOCUMENTS_LANDING.next.links[0]?.href).toBe(DOCUMENTS_ENTRY.docs);
  });
});
