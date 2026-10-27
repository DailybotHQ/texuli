// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareParity, llmsIdOf, SHARED_EXAMPLE_DIRS, twinIdOf } from '../check-llms-parity.ts';

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
