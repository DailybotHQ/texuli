// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COMPONENT_PAGE_GROUPS } from '../../apps/website/src/components/component-pages/load-manifests.ts';
import { ALL_MANIFEST_GROUPS } from '../../packages/catalog/src/manifests/all.ts';
import {
  compareParity,
  DOCS_ONLY_GROUPS,
  llmsIdOf,
  SHARED_EXAMPLE_DIRS,
  twinIdOf,
  unclassifiedGroups,
} from '../check-llms-parity.ts';

const CLEAN = {
  catalogIds: ['alert', 'button'],
  twinKeys: ['/component-pages/alert/', '/component-pages/button/'],
  llmsFiles: ['alert.md', 'button.md'],
  examples: [
    { id: 'alert-demo', sourcePath: 'alert/AlertDemo.svelte' },
    { id: 'button-demo', sourcePath: 'input/ButtonDemo.svelte' },
  ],
  exampleDirs: ['alert', 'input'],
  pathExists: (path: string) => !path.includes('missing'),
};

describe('compareParity', () => {
  it('reports nothing when all four sets reconcile; names a catalog id with no twin and no doc; names orphan twins and docs with no catalog manifest; rejects twin keys and doc names that are not component ids; rejects duplicate example ids and missing sources; rejects an example directory no entry covers; exempts exactly the named shared helper directories', () => {
    expect(compareParity(CLEAN)).toEqual([]);
    // names a catalog id with no twin and no doc
    {
      const fatal = compareParity({ ...CLEAN, catalogIds: [...CLEAN.catalogIds, 'badge'] });
      expect(fatal).toEqual([
        '[fatal] catalog id "badge" has no component-page twin',
        '[fatal] catalog id "badge" has no llms component doc',
      ]);
    }
    // names orphan twins and docs with no catalog manifest
    {
      const fatal = compareParity({
        ...CLEAN,
        twinKeys: [...CLEAN.twinKeys, '/component-pages/ghost/'],
        llmsFiles: [...CLEAN.llmsFiles, 'ghost.md'],
      });
      expect(fatal).toEqual([
        '[fatal] twin "/component-pages/ghost/" has no catalog manifest',
        '[fatal] llms doc "ghost.md" has no catalog manifest',
      ]);
    }
    // rejects twin keys and doc names that are not component ids
    {
      const fatal = compareParity({
        ...CLEAN,
        twinKeys: [...CLEAN.twinKeys, '/component-pages/'],
        llmsFiles: [...CLEAN.llmsFiles, 'README.md'],
      });
      expect(fatal).toEqual([
        '[fatal] twin key "/component-pages/" is not a component page',
        '[fatal] llms file "README.md" is not a component doc name',
      ]);
    }
    // rejects duplicate example ids and missing sources
    {
      const fatal = compareParity({
        ...CLEAN,
        examples: [
          ...CLEAN.examples,
          { id: 'alert-demo', sourcePath: 'alert/Other.svelte' },
          { id: 'new-demo', sourcePath: 'input/missing.svelte' },
        ],
      });
      expect(fatal).toContain('[fatal] duplicate example id "alert-demo"');
      expect(fatal).toContain(
        '[fatal] example "new-demo" sourcePath "input/missing.svelte" is missing'
      );
    }
    // rejects an example directory no entry covers
    {
      const fatal = compareParity({ ...CLEAN, exampleDirs: [...CLEAN.exampleDirs, 'orphan'] });
      expect(fatal).toEqual(['[fatal] example directory "orphan" has no entry']);
    }
    expect(SHARED_EXAMPLE_DIRS).toEqual(['core-safe-href', 'player-shared']);
  });
});

describe('id forms', () => {
  it('extracts component ids from twin keys and doc file names', () => {
    expect(twinIdOf('/component-pages/button/')).toBe('button');
    expect(twinIdOf('/component-pages/')).toBeNull();
    expect(twinIdOf('/guides/theming/')).toBeNull();
    expect(llmsIdOf('button.md')).toBe('button');
    expect(llmsIdOf('llms.txt')).toBeNull();
  });
});

describe('the docs-only rule', () => {
  it('lets docs-only ids skip the twin but never the llms doc; refuses a twin for a docs-only id; classifies every catalog group exactly once', () => {
    // docs-only ids need no twin, but still need an llms doc
    expect(
      compareParity({
        ...CLEAN,
        catalogIds: [...CLEAN.catalogIds, 'data-grid'],
        docsOnlyIds: ['data-grid'],
        llmsFiles: [...CLEAN.llmsFiles, 'data-grid.md'],
      })
    ).toEqual([]);
    expect(
      compareParity({
        ...CLEAN,
        catalogIds: [...CLEAN.catalogIds, 'data-grid'],
        docsOnlyIds: ['data-grid'],
      })
    ).toEqual(['[fatal] catalog id "data-grid" has no llms component doc']);
    // a twin for a docs-only id means the group moved without the list
    expect(compareParity({ ...CLEAN, docsOnlyIds: ['alert'] })).toEqual([
      '[fatal] docs-only id "alert" has a component-page twin; move its group',
    ]);
    // every group is a page group or docs-only, never both, never unknown
    expect(unclassifiedGroups(['a', 'b', 'c'], ['a', 'b'], ['b', 'x'])).toEqual([
      '[fatal] manifest group "b" is both a page group and docs-only',
      '[fatal] manifest group "c" is neither a component-page group nor docs-only',
      '[fatal] "x" is not a catalog manifest group',
    ]);
    // the real catalog (all groups of @texuli/catalog/manifests/all) is fully classified
    expect(
      unclassifiedGroups(
        ALL_MANIFEST_GROUPS.map((group) => group.name),
        COMPONENT_PAGE_GROUPS,
        DOCS_ONLY_GROUPS
      )
    ).toEqual([]);
  });
});
