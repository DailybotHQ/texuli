// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every public subpath of @texuli/document has a docs page linked from the
 * README, and every name it exports (following `export *` re-exports) is
 * mentioned in that page. The planned subpaths are documented as planned
 * and not exported. New API cannot land undocumented.
 */
const ROOT = 'packages/document';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');
const DOCS_URL = 'https://github.com/DailybotHQ/texuli/blob/main/packages/document';

const SUBPATH_DOCS: Record<string, { doc: string; entry: string }> = {
  './model': { doc: 'docs/model.md', entry: 'src/model/index.ts' },
  './schema': { doc: 'docs/schema.md', entry: 'src/schema/index.ts' },
  './ops': { doc: 'docs/ops.md', entry: 'src/ops/index.ts' },
  './markdown': { doc: 'docs/markdown.md', entry: 'src/markdown/index.ts' },
  './paged': { doc: 'docs/paged.md', entry: 'src/paged/index.ts' },
  './docx': { doc: 'docs/docx.md', entry: 'src/docx/index.ts' },
  './pdf': { doc: 'docs/pdf.md', entry: 'src/pdf/index.ts' },
  './sync': { doc: 'docs/sync.md', entry: 'src/sync/index.ts' },
  './collab': { doc: 'docs/collab.md', entry: 'src/collab/index.ts' },
};
const PLANNED: string[] = [];

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

describe('document documentation', () => {
  it('maps every subpath to a linked docs page that documents every exported name', () => {
    const exportsMap = JSON.parse(read('package.json')).exports as Record<string, unknown>;
    const readme = read('README.md');
    expect(
      Object.keys(exportsMap)
        .filter((key) => key !== '.')
        .sort()
    ).toEqual(Object.keys(SUBPATH_DOCS).sort());
    for (const [subpath, { doc, entry }] of Object.entries(SUBPATH_DOCS)) {
      expect(existsSync(`${ROOT}/${doc}`), doc).toBe(true);
      expect(readme, subpath).toContain(`](${DOCS_URL}/${doc})`);
      const names = exportedNames(entry);
      expect(names.length, entry).toBeGreaterThan(0);
      const page = read(doc);
      expect(
        names.filter((name) => !mentions(page, name)),
        `${doc} does not mention`
      ).toEqual([]);
    }
    const root = exportedNames('src/index.ts');
    expect(root.length).toBeGreaterThan(60);
    expect(root).not.toContain('createReplica');
    expect(root).not.toContain('createDocumentSync');
  });

  it('marks the planned subpaths as planned and does not export them', () => {
    const exportsMap = JSON.parse(read('package.json')).exports as Record<string, unknown>;
    const readme = read('README.md');
    for (const name of PLANNED) {
      expect(Object.keys(exportsMap)).not.toContain(`./${name}`);
      expect(readme).toMatch(
        new RegExp(`\`${name}\`[^\\n]*planned|planned[^\\n]*\`${name}\``, 'i')
      );
    }
    expect(readme).toMatch(/Status: in development/);
    expect(readme).toContain('utm_source=dailybotopensource');
  });

  it('states the release status honestly: published from 0.7.0, never the placeholder', () => {
    const manifest = JSON.parse(read('package.json')) as { version: string };
    // First published in 0.7.0; the 0.0.0 placeholder is gone for good.
    expect(manifest.version).not.toBe('0.0.0');
    const readme = read('README.md');
    expect(readme).toMatch(/published on\s+(?:>\s+)?npm/);
    expect(readme).toContain(`\`${manifest.version}\``);
    const pages = [readme, ...readdirSync(`${ROOT}/docs`).map((file) => read(`docs/${file}`))];
    for (const page of pages)
      expect(page).not.toMatch(
        /not on npm yet|0\.0\.0` placeholder|repository only|first release (?:is )?planned/i
      );
  });
});
