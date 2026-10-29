// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every public subpath of @texuli/pages has a docs page linked from the
 * README; every name it exports, every component prop and every stylesheet
 * hook is mentioned there. The planned subpaths are documented as planned
 * and not exported. New API cannot land undocumented.
 */
const ROOT = 'packages/pages';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');
const DOCS_URL = 'https://github.com/DailybotHQ/texuli/blob/main/packages/pages';

const SUBPATH_DOCS: Record<string, { doc: string; entry?: string; component?: string }> = {
  './editor': {
    doc: 'docs/editor.md',
    entry: 'src/editor/index.ts',
    component: 'src/editor/PageEditor.svelte',
  },
  './reader': {
    doc: 'docs/reader.md',
    entry: 'src/reader/index.ts',
    component: 'src/reader/PageReader.svelte',
  },
  './collab': {
    doc: 'docs/collab.md',
    entry: 'src/collab/index.ts',
    component: 'src/collab/CollabEditor.svelte',
  },
  './paged': {
    doc: 'docs/paged.md',
    entry: 'src/paged/index.ts',
    component: 'src/paged/PagedView.svelte',
  },
  './export': { doc: 'docs/export.md', entry: 'src/export/index.ts' },
  './host': { doc: 'docs/host.md', entry: 'src/host/index.ts' },
  './styles.css': { doc: 'docs/styles.md' },
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

function propNames(component: string): string[] {
  const body = /interface Props \{([\s\S]*?)\n\}/.exec(read(component))?.[1] ?? '';
  return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1] as string);
}

describe('pages documentation', () => {
  const exportsMap = JSON.parse(read('package.json')).exports as Record<string, unknown>;
  const readme = read('README.md');

  it('maps every subpath to a linked page that documents every export and component prop', () => {
    expect(
      Object.keys(exportsMap)
        .filter((key) => key !== '.')
        .sort()
    ).toEqual(Object.keys(SUBPATH_DOCS).sort());
    for (const [subpath, { doc, entry, component }] of Object.entries(SUBPATH_DOCS)) {
      expect(existsSync(`${ROOT}/${doc}`), doc).toBe(true);
      expect(readme, subpath).toContain(`](${DOCS_URL}/${doc})`);
      const page = read(doc);
      if (entry) {
        const names = exportedNames(entry);
        expect(names.length, entry).toBeGreaterThan(0);
        expect(
          names.filter((name) => !mentions(page, name)),
          `${doc} does not mention`
        ).toEqual([]);
      }
      if (component) {
        const props = propNames(component);
        expect(props.length, component).toBeGreaterThan(5);
        expect(
          props.filter((name) => !mentions(page, name)),
          `${doc} props`
        ).toEqual([]);
      }
    }
    expect(exportedNames('src/index.ts')).toEqual(
      expect.arrayContaining(['PageEditor', 'PageReader', 'PAGES_PACKAGE_VERSION'])
    );
    expect(readme).toContain('`PAGES_PACKAGE_VERSION`');
  });

  it('documents every class hook the stylesheet defines', () => {
    const css = read('src/styles.css');
    const hooks = new Set([...css.matchAll(/\.(tx-pages[\w-]*)/g)].map((m) => m[1] as string));
    const page = read('docs/styles.md');
    expect([...hooks].filter((hook) => !page.includes(`.${hook}`))).toEqual([]);
  });

  it('documents every class hook and named page the paged stylesheet defines', () => {
    const css = read('src/paged/paged.css');
    const hooks = new Set(
      [...css.matchAll(/\.(tx-pages-paged[\w-]*)/g)].map((m) => m[1] as string)
    );
    const pages = new Set([...css.matchAll(/@page (tx-pages-[\w-]+)/g)].map((m) => m[1] as string));
    expect(hooks.size).toBeGreaterThan(5);
    expect(pages.size).toBe(8);
    const page = read('docs/paged.md');
    expect([...hooks].filter((hook) => !page.includes(`.${hook}`))).toEqual([]);
    expect([...pages].filter((name) => !page.includes(name))).toEqual([]);
  });

  it('marks the planned subpaths as planned and does not export them', () => {
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
    // The exported constant tracks the manifest version.
    expect(read('src/index.ts')).toContain(
      `export const PAGES_PACKAGE_VERSION = '${manifest.version}';`
    );
  });
});
