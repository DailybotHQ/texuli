/**
 * T-81 — punch-list row 3: family differentiators on the catalog surfaces.
 *
 * The T-06 census found one-line leads that answer "what is it" but never
 * "why this family here". `family-notes.ts` adds a per-family note (never
 * hand-written per page) rendered on every component page, on the index and
 * as the meta description tail. The vitest suite cannot compile .astro
 * templates, so the templates are pinned at their seams as source
 * (the pattern of `web-hero.test.ts`).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FAMILY_NOTES, familyNote } from '../src/components/component-pages/family-notes.ts';
import {
  COMPONENT_PAGES,
  componentPagesByGroup,
} from '../src/components/component-pages/load-manifests.ts';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const readSource = (fromSrc: string) => readFileSync(resolve(srcDir, fromSrc), 'utf8');

describe('every catalog family has a differentiator note', () => {
  it('covers all five catalog groups', () => {
    const groups = [...componentPagesByGroup().keys()].sort();
    expect(groups).toEqual(['content', 'display', 'forms', 'layouts', 'overlays']);
    for (const group of groups) {
      const note = familyNote(group);
      expect(note, `missing note for group "${group}"`).toBeDefined();
      expect(note?.headline.length).toBeGreaterThan(0);
      expect(note?.body.length).toBeGreaterThan(0);
    }
  });

  it('covers every page rendered today', () => {
    expect(COMPONENT_PAGES.length).toBeGreaterThan(100);
    for (const entry of COMPONENT_PAGES) {
      expect(familyNote(entry.group), `no note for ${entry.id} (${entry.group})`).toBeDefined();
    }
  });

  it('returns undefined for an unknown group', () => {
    expect(familyNote('not-a-group')).toBeUndefined();
  });

  it('keeps the map closed to the known groups', () => {
    expect(Object.keys(FAMILY_NOTES).sort()).toEqual([
      'content',
      'display',
      'forms',
      'layouts',
      'overlays',
    ]);
  });
});

describe('the copy stays honest and specific', () => {
  const notes = Object.entries(FAMILY_NOTES);

  it('never hypes or invents numbers', () => {
    for (const [group, note] of notes) {
      const { headline, body } = note;
      expect(headline, group).not.toMatch(
        /\b(best|fastest|blazing|revolutionary|world-class|perfect)\b/i
      );
      expect(body, group).not.toMatch(
        /\b(best|fastest|blazing|revolutionary|world-class|perfect)\b/i
      );
      expect(headline, group).not.toMatch(/\d+\s?%|\b\d+\s?ms\b|\b\d+(\.\d+)?\s?x\b/);
      expect(body, group).not.toMatch(/\d+\s?%|\b\d+\s?ms\b|\b\d+(\.\d+)?\s?x\b/);
    }
  });

  it('names the mechanism it claims (provable, not adjectives)', () => {
    expect(familyNote('content')?.body).toContain('sink-free renderer');
    expect(familyNote('display')?.body).toContain('--tx-*');
    expect(familyNote('forms')?.body).toContain('keyboard');
    expect(familyNote('layouts')?.body).toContain('logical CSS');
    expect(familyNote('overlays')?.body).toContain('Escape');
  });

  it('headlines stay short enough for a meta description tail', () => {
    for (const [group, note] of notes) {
      expect(note.headline.length, group).toBeLessThanOrEqual(80);
    }
  });

  it('is plain text: no markup, no HTML sinks in the copy', () => {
    for (const [group, note] of notes) {
      expect(note.headline, group).not.toMatch(/[<>{}]/);
      expect(note.body, group).not.toMatch(/[<>{}]/);
    }
  });
});

describe('the templates render the notes', () => {
  it('the component page body shows the note under the lead', () => {
    const source = readSource('components/component-pages/ComponentPageBody.astro');
    expect(source).toContain('familyNote(entry.group)');
    expect(source).toContain('<strong>{note.headline}</strong>');
    expect(source).toContain('cp__family');
  });

  it('the component page body renders the theme strip', () => {
    const source = readSource('components/component-pages/ComponentPageBody.astro');
    expect(source).toContain("import ThemeStrip from './ThemeStrip.astro'");
    expect(source).toContain('<ThemeStrip />');
  });

  it('the index shows the family line under each group heading', () => {
    const index = readSource('pages/component-pages/index.astro');
    expect(index).toContain('familyNote(group)');
    expect(index).toContain('family-note');
  });

  it('the detail page tailors the meta description with the headline', () => {
    const detail = readSource('pages/component-pages/[id].astro');
    expect(detail).toContain('note.headline');
    expect(detail).toContain('Catalog id');
  });
});
