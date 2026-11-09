import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { texuliOps } from '@texuli/tools/ops';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENTS_AGENTS,
  DOCUMENTS_NEXT,
  DOCUMENTS_PLATFORMS,
  DOCUMENTS_RECIPES,
} from '../../src/components/solutions/documents/extras/extras-content.ts';
import {
  agentSurfaceViews,
  platformRows,
} from '../../src/components/solutions/shared/platforms/platforms-model.ts';
import {
  nextStepsView,
  recipesView,
} from '../../src/components/solutions/shared/resources/resources-model.ts';
import { getSolution } from '../../src/data/solutions/index.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const EXTRAS = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/documents/extras/DocumentsExtras.astro'),
  'utf8'
);
const CONTENT = readFileSync(
  resolve(WEBSITE, 'src/components/solutions/documents/extras/extras-content.ts'),
  'utf8'
);
const entry = getSolution('documents');
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

describe('Documents extras', () => {
  it('takes platform rows from the registry without raising native status', () => {
    expect(DOCUMENTS_PLATFORMS.title).toBe('Platforms');
    expect(platformRows(entry).map((row) => [row.platform, row.badge.status])).toEqual([
      ['web', 'in development'],
      ['compose-desktop', 'planned'],
      ['android', 'planned'],
      ['ios', 'planned'],
    ]);
  });

  it('names only MCP operations, catalog ids and skill files that exist', () => {
    const labels = DOCUMENTS_AGENTS.surfaces.map((surface) => surface.label);
    expect(labels).toEqual([
      'document.run',
      'document.export',
      'document',
      'skills/texuli/blueprints/references/documents.md',
    ]);
    expect(opsOn('edge').has('document.run')).toBe(true);
    // document.export needs Node: the copy says it runs on the local server only.
    expect(opsOn('edge').has('document.export')).toBe(false);
    expect(opsOn('node').has('document.export')).toBe(true);
    expect(DOCUMENTS_AGENTS.surfaces[1]?.detail).toMatch(/local server/);
    expect(catalogIds.has('document')).toBe(true);
    expect(existsSync(resolve(REPO, 'skills/texuli/blueprints/references/documents.md'))).toBe(
      true
    );
  });

  it('marks every surface in development, as the packages are, and never available', () => {
    expect(agentSurfaceViews(DOCUMENTS_AGENTS.surfaces).map((v) => v.badge.status)).toEqual([
      'in development',
      'in development',
      'in development',
      'in development',
    ]);
    expect(JSON.stringify(DOCUMENTS_AGENTS)).not.toMatch(/\bavailable\b|PLAN_|plan 015/i);
  });

  it('claims only capabilities the README and registry back, and nothing planned as done', () => {
    const copy = JSON.stringify([DOCUMENTS_RECIPES, DOCUMENTS_AGENTS]);
    const readme = readFileSync(resolve(REPO, 'packages/document/README.md'), 'utf8');
    for (const fact of ['undo', 'Markdown', 'DOCX', 'PDF', 'RFC 6902'])
      expect(readme, fact).toContain(fact);
    expect(copy).not.toMatch(/paged[- ]view editing|hosted|cloud|real-?time service/i);
    expect(entry.capabilities.find((c) => c.id === 'paged-editing')?.status).toBe('planned');
  });

  it('links recipes only to pages or package pages that exist, never the replaced demo page', () => {
    const view = recipesView({ entry, ...DOCUMENTS_RECIPES });
    expect(view.recipes.length).toBe(DOCUMENTS_RECIPES.recipes.length);
    for (const recipe of DOCUMENTS_RECIPES.recipes) {
      if (recipe.href.startsWith('https:')) {
        expect(recipe.href).toMatch(
          /^https:\/\/www\.npmjs\.com\/package\/@texuli\/(document|pages)$/
        );
        const pkg = recipe.href.split('/package/')[1] as string;
        expect(entry.packages.map((p) => p.name)).toContain(pkg);
      } else {
        expect(pageExists(recipe.href), recipe.href).toBe(true);
      }
    }
    expect(CONTENT.match(/href: '\/documents-page\/'/)).toBeNull();
  });

  it('puts the docs route first on next steps', () => {
    const view = nextStepsView({ entry, ...DOCUMENTS_NEXT });
    expect(view.links[0]).toMatchObject({ href: '/guides/solutions/documents/', kind: 'primary' });
    expect(pageExists('/guides/solutions/documents/')).toBe(true);
    expect(view.links.some((link) => link.href === '/documents-page/')).toBe(false);
  });

  it('composes the five shared blocks statically', () => {
    for (const block of [
      'SolutionRecipes',
      'SolutionAgents',
      'SolutionPlatforms',
      'SolutionRelated',
      'SolutionNextSteps',
    ])
      expect(EXTRAS).toContain(`<${block} entry={entry}`);
    expect(EXTRAS).toContain("getSolution('documents')");
    expect(EXTRAS).not.toMatch(/client:|set:html|\{@html|<script\b/);
    expect(CONTENT).not.toMatch(/import\.meta\.dirname|readFileSync|node:fs/);
  });
});
