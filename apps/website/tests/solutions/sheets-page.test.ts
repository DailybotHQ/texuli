import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { twinNoteFor } from '../../src/components/docs/twin-notes.ts';
import { siteLlmsSections } from '../../src/components/seo/llms-site.ts';
import { checkLandingContent } from '../../src/components/solutions/shared/types.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';
import { SHEETS_ENTRY, SHEETS_LANDING } from '../../src/pages/solutions/sheets/_content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const PAGE = readFileSync(resolve(WEBSITE, 'src/pages/solutions/sheets/index.astro'), 'utf8');
const markup = PAGE.slice(PAGE.indexOf('---', 3) + 3);

describe('/solutions/sheets/ (the Sheets Solution landing)', () => {
  it('is consistent with its registry entry', () => {
    expect(SHEETS_ENTRY.slug).toBe('sheets');
    expect(checkLandingContent(SHEETS_ENTRY, SHEETS_LANDING)).toEqual([]);
  });

  it('ships the landing and docs routes the registry names', () => {
    const result = validateSolutionRegistry([SHEETS_ENTRY], { requireRoutes: true });
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

  it('hydrates exactly one island, the Sheets demo, when visible, with an SSR preview', () => {
    const islands = [...markup.matchAll(/<(\w+)[^>]*\bclient:(\w+)/g)].map(
      (m) => `${m[1]}:${m[2]}`
    );
    expect(islands).toEqual(['SheetsDemo:visible']);
    expect(markup).toContain('<SheetsPreview slot="preview" />');
  });

  it('has no HTML sinks and never links the route it replaces', () => {
    expect(PAGE).not.toMatch(/set:html|\{@html|innerHTML/);
    expect(PAGE).not.toContain(SHEETS_ENTRY.replaces ?? '/sheets-page/');
    expect(JSON.stringify(SHEETS_LANDING)).not.toContain('/sheets-page/');
    expect(SHEETS_ENTRY.links.some((link) => link.href.includes('/sheets-page/'))).toBe(false);
  });

  it('is described for agents: llms.txt section and a Markdown twin note', () => {
    const solutions = siteLlmsSections('https://texuli.com').find((s) => s.name === 'Solutions');
    expect(solutions?.links.map((l) => l.href)).toContain('https://texuli.com/solutions/sheets/');
    const note = twinNoteFor('/solutions/sheets/');
    expect(note?.operations).toContain('catalog.search');
    expect(note?.links?.map((l) => l.href)).toContain('/guides/solutions/sheets/');
  });
});
