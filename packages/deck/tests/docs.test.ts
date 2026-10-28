// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every public subpath of @texuli/deck has a docs page linked from the
 * README, and every name it exports (following `export *` re-exports) is
 * mentioned in that page. New API cannot land undocumented.
 */
const ROOT = 'packages/deck';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');
const DOCS_URL = 'https://github.com/DailybotHQ/texuli/blob/main/packages/deck';

const SUBPATH_DOCS: Record<string, { doc: string; entry: string }> = {
  './model': { doc: 'docs/model.md', entry: 'src/model/index.ts' },
  './schema': { doc: 'docs/schema.md', entry: 'src/schema/index.ts' },
  './engine': { doc: 'docs/engine.md', entry: 'src/engine/index.ts' },
  './markdown': { doc: 'docs/markdown.md', entry: 'src/markdown/index.ts' },
  './math': { doc: 'docs/math.md', entry: 'src/math/index.ts' },
  './authoring': { doc: 'docs/authoring.md', entry: 'src/authoring/index.ts' },
  './templates': { doc: 'docs/templates.md', entry: 'src/templates/index.ts' },
};

/**
 * Exported names of one module: `export { … }`, `export type { … }`,
 * declarations, and the names of every `export * from './x.ts'` target.
 */
function exportedNames(path: string, seen = new Set<string>()): string[] {
  if (seen.has(path)) return [];
  seen.add(path);
  const source = read(path);
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const raw of (match[1] ?? '').split(',')) {
      const part = raw.trim().replace(/^type\s+/, '');
      const name = /(?:\w+\s+as\s+)?(\w+)$/.exec(part)?.[1];
      if (name) names.add(name);
    }
  }
  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|type|interface|class)\s+(\w+)/g
  )) {
    if (match[1]) names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+\*\s+from\s+'(\.[^']+)'/g)) {
    const target = join(dirname(path), match[1] as string);
    for (const name of exportedNames(target, seen)) names.add(name);
  }
  return [...names].sort();
}

const mentions = (doc: string, name: string) => new RegExp(`\`${name}\\b`).test(doc);

describe('deck documentation', () => {
  const exportsMap = JSON.parse(read('package.json')).exports as Record<string, unknown>;
  const readme = read('README.md');

  it('maps every subpath to a linked docs page that documents every exported name and the root exports', () => {
    // maps every package subpath to a docs page
    {
      const subpaths = Object.keys(exportsMap).filter((key) => key !== '.');
      expect(subpaths.sort()).toEqual(Object.keys(SUBPATH_DOCS).sort());
    }
    for (const [subpath, { doc, entry }] of Object.entries(SUBPATH_DOCS)) {
      expect(existsSync(`${ROOT}/${doc}`), doc).toBe(true);
      // npm renders the README off-repo, so it links docs by absolute URL.
      expect(readme, subpath).toContain(`](${DOCS_URL}/${doc})`);
      const names = exportedNames(entry);
      expect(names.length, entry).toBeGreaterThan(0);
      const page = read(doc);
      const missing = names.filter((name) => !mentions(page, name));
      expect(missing, `${doc} does not mention`).toEqual([]);
    }
    // documents every root export in the README or a docs page
    {
      const all = [readme, ...Object.values(SUBPATH_DOCS).map(({ doc }) => read(doc))].join('\n');
      const names = exportedNames('src/index.ts');
      expect(names.length).toBeGreaterThan(100);
      expect(names.filter((name) => !mentions(all, name))).toEqual([]);
    }
  });
});
