import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  agentSurfaceViews,
  platformRows,
} from '../../src/components/solutions/shared/platforms/platforms-model.ts';
import {
  nextStepsView,
  recipesView,
} from '../../src/components/solutions/shared/resources/resources-model.ts';
import {
  SHEETS_AGENTS,
  SHEETS_NEXT,
  SHEETS_PLATFORMS,
  SHEETS_RECIPES,
} from '../../src/components/solutions/sheets/extras/extras-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const ROOT = resolve('.');
const WEBSITE = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');
const EXTRAS = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/sheets/extras/SheetsExtras.astro'),
  'utf8'
);
const entry = getSolution('sheets');

function pageExists(href: string): boolean {
  return existsSync(resolve(WEBSITE, 'src/pages', href.replace(/^\/|\/$/g, ''), 'index.astro'));
}

describe('Sheets extras', () => {
  it('takes platform rows from the registry without raising native status', () => {
    expect(SHEETS_PLATFORMS.title).toBe('Platforms');
    expect(platformRows(entry).map((row) => [row.platform, row.badge.status])).toEqual([
      ['web', 'in development'],
      ['compose-desktop', 'planned'],
      ['android', 'planned'],
      ['ios', 'planned'],
    ]);
  });

  it('names only catalog and skill surfaces that exist for sheets', () => {
    expect(SHEETS_AGENTS.surfaces.map((s) => s.label)).toEqual([
      'spreadsheet',
      'validateDraft',
      'skills/texuli/blueprints/SKILL.md',
    ]);
    expect(read('packages/catalog/src/manifests/sheets/index.ts')).toContain(
      "export const SPREADSHEET_CATALOG_ID = 'spreadsheet'"
    );
    const draft = read('packages/catalog/src/validate/draft.ts');
    expect(draft).toContain('export function validateDraft(');
    expect(draft).toContain('checkSheet?: DraftSheetCheck');
    expect(read('packages/sheets/src/model/schema.ts')).toContain(
      'export function checkSheetDraft('
    );
    expect(read('skills/texuli/blueprints/SKILL.md')).toMatch(/## J — Forms, canvases, sheets/);
    expect(agentSurfaceViews(SHEETS_AGENTS.surfaces).map((v) => v.badge.status)).toEqual([
      'in development',
      'in development',
      'in development',
    ]);
  });

  it('is honest that the remote MCP server refuses spreadsheet nodes', () => {
    expect(read('packages/tools/src/ops/blueprint.ts')).toMatch(
      /schema-form, canvas and spreadsheet nodes and data-source bindings are refused/
    );
    expect(SHEETS_AGENTS.body).toContain('the remote MCP server refuses spreadsheet nodes');
    const copy = JSON.stringify({ SHEETS_AGENTS, SHEETS_RECIPES, SHEETS_NEXT });
    expect(copy).not.toMatch(/\b(available|hosted|realtime service|production[- ]ready)\b/i);
    expect(copy).not.toMatch(/PLAN_|plan 015/i);
  });

  it('links recipes only to pages or packages that exist', () => {
    expect(recipesView({ entry, ...SHEETS_RECIPES }).recipes.length).toBeGreaterThan(0);
    for (const recipe of SHEETS_RECIPES.recipes) {
      if (recipe.href.startsWith('https:')) {
        expect(recipe.href).toBe('https://www.npmjs.com/package/@texuli/sheets');
      } else {
        expect(pageExists(recipe.href), recipe.href).toBe(true);
        expect(recipe.href).not.toMatch(/-page\//);
      }
    }
  });

  it('puts the docs route first on next steps and never links /sheets-page/', () => {
    const view = nextStepsView({ entry, ...SHEETS_NEXT });
    expect(view.links[0]).toMatchObject({ href: '/guides/solutions/sheets/', kind: 'primary' });
    expect(pageExists(entry.docs)).toBe(true);
    expect(view.links.some((link) => link.href.includes('/sheets-page/'))).toBe(false);
  });

  it('composes the five shared blocks statically', () => {
    for (const block of [
      'SolutionRecipes',
      'SolutionAgents',
      'SolutionPlatforms',
      'SolutionRelated',
      'SolutionNextSteps',
    ])
      expect(EXTRAS).toContain(block);
    expect(EXTRAS).toContain("getSolution('sheets')");
    expect(EXTRAS).not.toMatch(/client:|set:html|\{@html|import\.meta\.dirname|node:fs/);
  });
});
