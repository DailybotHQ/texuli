import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { texuliOps } from '@texuli/tools/ops';
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
  WORKFLOWS_AGENTS,
  WORKFLOWS_NEXT,
  WORKFLOWS_PLATFORMS,
  WORKFLOWS_RECIPES,
} from '../../src/components/solutions/workflows/extras/extras-content.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const EXTRAS = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/workflows/extras/WorkflowsExtras.astro'),
  'utf8'
);
const CONTENT = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/workflows/extras/extras-content.ts'),
  'utf8'
);
const entry = getSolution('workflows');
const opsOn = (runtime: 'edge' | 'node') =>
  new Set(texuliOps.list({ runtimes: [runtime] }).map((op) => op.name));
const catalogIds = new Set(
  (
    JSON.parse(readFileSync(resolve(REPO, 'packages/spec/catalog/components.json'), 'utf8')) as {
      components: { id: string }[];
    }
  ).components.map((c) => c.id)
);

function pageExists(href: string): boolean {
  return existsSync(resolve(WEBSITE, 'src/pages', href.replace(/^\/|\/$/g, ''), 'index.astro'));
}

describe('Workflows extras', () => {
  it('takes platform rows from the registry without raising native status', () => {
    expect(WORKFLOWS_PLATFORMS.title).toBe('Platforms');
    expect(platformRows(entry).map((row) => [row.platform, row.badge.status])).toEqual([
      ['web', 'in development'],
      ['compose-desktop', 'planned'],
      ['android', 'planned'],
      ['ios', 'planned'],
    ]);
  });

  it('names only MCP operations, catalog ids and skill files that exist', () => {
    expect(WORKFLOWS_AGENTS.surfaces.map((s) => s.label)).toEqual([
      'workflow-graph',
      'catalog.validate',
      'blueprint.validate',
      'skills/texuli/build-ui/references/recipes.md',
    ]);
    expect(catalogIds.has('workflow-graph')).toBe(true);
    expect(opsOn('edge').has('catalog.validate')).toBe(true);
    expect(opsOn('edge').has('blueprint.validate')).toBe(true);
    expect(opsOn('edge').has('workflow.run')).toBe(false);
    expect(existsSync(resolve(REPO, 'skills/texuli/build-ui/references/recipes.md'))).toBe(true);
    expect(
      readFileSync(resolve(REPO, 'packages/catalog/src/manifests/workflows/index.ts'), 'utf8')
    ).toContain("id: 'workflow-graph'");
    expect(agentSurfaceViews(WORKFLOWS_AGENTS.surfaces).map((v) => v.badge.status)).toEqual([
      'in development',
      'in development',
      'in development',
      'in development',
    ]);
  });

  it('is honest that no MCP operation runs a workflow', () => {
    expect(WORKFLOWS_AGENTS.body).toContain('There is no MCP operation that runs a workflow');
    const copy = JSON.stringify({ WORKFLOWS_AGENTS, WORKFLOWS_RECIPES, WORKFLOWS_NEXT });
    expect(copy).not.toMatch(/\b(available|hosted|production[- ]ready)\b/i);
    expect(copy).not.toMatch(/PLAN_|plan 015/i);
    expect(CONTENT).not.toMatch(/import\.meta\.dirname|node:fs/);
  });

  it('links recipes only to pages or packages that exist', () => {
    expect(recipesView({ entry, ...WORKFLOWS_RECIPES }).recipes.length).toBeGreaterThan(0);
    for (const recipe of WORKFLOWS_RECIPES.recipes) {
      if (recipe.href.startsWith('https:')) {
        expect(recipe.href).toBe('https://www.npmjs.com/package/@texuli/workflows');
        continue;
      }
      expect(pageExists(recipe.href), recipe.href).toBe(true);
      expect(recipe.href === '/workflows-page/').toBe(false);
      if (recipe.href.includes('/workflows-page/')) {
        expect(recipe.href).toBe('/workflows-page/json/');
      }
    }
  });

  it('puts the docs route first on next steps and never links /workflows-page/', () => {
    const view = nextStepsView({ entry, ...WORKFLOWS_NEXT });
    expect(view.links[0]).toMatchObject({ href: '/guides/solutions/workflows/', kind: 'primary' });
    expect(pageExists(entry.docs)).toBe(true);
    expect(
      view.links.some(
        (link) => link.href === '/workflows-page/' || link.href.endsWith('/workflows-page/')
      )
    ).toBe(false);
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
    expect(EXTRAS).toContain("getSolution('workflows')");
    expect(EXTRAS).not.toMatch(/client:|set:html|\{@html|import\.meta\.dirname|node:fs/);
  });
});
