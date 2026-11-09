import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { twinNoteFor } from '../../src/components/docs/twin-notes.ts';
import { siteLlmsSections } from '../../src/components/seo/llms-site.ts';
import { checkLandingContent } from '../../src/components/solutions/shared/types.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';
import {
  WORKFLOWS_ENTRY,
  WORKFLOWS_LANDING,
} from '../../src/pages/solutions/workflows/_content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const PAGE = readFileSync(resolve(WEBSITE, 'src/pages/solutions/workflows/index.astro'), 'utf8');
const markup = PAGE.slice(PAGE.indexOf('---', 3) + 3);

describe('/solutions/workflows/ (the Workflows Solution landing)', () => {
  it('is consistent with its registry entry', () => {
    expect(WORKFLOWS_ENTRY.slug).toBe('workflows');
    expect(checkLandingContent(WORKFLOWS_ENTRY, WORKFLOWS_LANDING)).toEqual([]);
  });

  it('ships the landing and docs routes the registry names', () => {
    const result = validateSolutionRegistry([WORKFLOWS_ENTRY], { requireRoutes: true });
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

  it('hydrates exactly one island, the Workflows demo, when visible, with an SSR preview', () => {
    const islands = [...markup.matchAll(/<(\w+)[^>]*\bclient:(\w+)/g)].map(
      (m) => `${m[1]}:${m[2]}`
    );
    expect(islands).toEqual(['WorkflowsDemo:visible']);
    expect(markup).toContain('<WorkflowPreview slot="preview" />');
  });

  it('has no HTML sinks and never links the route it replaces', () => {
    expect(PAGE).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(PAGE).not.toContain('/workflows-page/');
  });

  it('is described for agents: llms.txt section and a Markdown twin note', () => {
    const solutions = siteLlmsSections('https://texuli.com').find((s) => s.name === 'Solutions');
    expect(solutions?.links.map((l) => l.href)).toContain(
      'https://texuli.com/solutions/workflows/'
    );
    const note = twinNoteFor('/solutions/workflows/');
    expect(note?.operations).toContain('blueprint.validate');
    expect(note?.links?.map((l) => l.href)).toContain('/guides/solutions/workflows/');
  });
});

describe('/solutions/workflows/ links and facts', () => {
  it('links nothing to /workflows-page/, from the page, its content or the registry', () => {
    const facts = JSON.stringify({ WORKFLOWS_ENTRY, WORKFLOWS_LANDING }).replace(
      '"replaces":"/workflows-page/"',
      ''
    );
    expect(facts).not.toContain('"href":"/workflows-page/"');
    expect(WORKFLOWS_ENTRY.replaces).toBe('/workflows-page/');
    expect(WORKFLOWS_ENTRY.links.some((link) => link.href === '/workflows-page/json/')).toBe(true);
  });

  it('keeps the twin facts equal to the registry: status, packages and the docs link', () => {
    const note = twinNoteFor('/solutions/workflows/');
    expect(note?.packages).toEqual(['workflows']);
    const solutions = siteLlmsSections('https://texuli.com').find((s) => s.name === 'Solutions');
    const link = solutions?.links.find((l) => l.href === 'https://texuli.com/solutions/workflows/');
    expect(link?.description).toContain(`Status: ${WORKFLOWS_ENTRY.status}.`);
    expect(WORKFLOWS_LANDING.next.links[0]?.href).toBe(WORKFLOWS_ENTRY.docs);
  });
});
