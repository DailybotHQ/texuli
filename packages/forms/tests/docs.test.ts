// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every public subpath of @texuli/forms has a docs page linked from the
 * README; every name it exports, every SchemaForm prop and every stylesheet
 * hook is mentioned there. New API cannot land undocumented, and the
 * release status stays honest.
 */
const ROOT = 'packages/forms';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');
const DOCS_URL = 'https://github.com/DailybotHQ/texuli/blob/main/packages/forms';

const SUBPATH_DOCS: Record<string, { doc: string; entry?: string; component?: string }> = {
  '.': {
    doc: 'docs/schema-form.md',
    entry: 'src/index.ts',
    component: 'src/view/SchemaForm.svelte',
  },
  './model': { doc: 'docs/model.md', entry: 'src/model/index.ts' },
  './controls': { doc: 'docs/controls.md', entry: 'src/view/controls/index.ts' },
  './host': { doc: 'docs/host.md', entry: 'src/host/index.ts' },
  './styles.css': { doc: 'docs/styles.md' },
};

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
  const body = /interface Props[^{]*\{([\s\S]*?)\n\}/.exec(read(component))?.[1] ?? '';
  return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1] as string);
}

describe('forms documentation', () => {
  const exportsMap = JSON.parse(read('package.json')).exports as Record<string, unknown>;
  const readme = read('README.md');

  it('maps every subpath to a linked page that documents every export and SchemaForm prop', () => {
    expect(Object.keys(exportsMap).sort()).toEqual(Object.keys(SUBPATH_DOCS).sort());
    for (const [subpath, { doc, entry, component }] of Object.entries(SUBPATH_DOCS)) {
      expect(existsSync(`${ROOT}/${doc}`), doc).toBe(true);
      expect(readme, subpath).toContain(`](${DOCS_URL}/${doc})`);
      const page = read(doc);
      if (entry) {
        const names = exportedNames(entry);
        expect(names.length, entry).toBeGreaterThan(5);
        expect(
          names.filter((name) => !mentions(page, name)),
          `${doc} does not mention`
        ).toEqual([]);
      }
      if (component) {
        const props = propNames(component);
        expect(props.length, component).toBeGreaterThan(10);
        expect(
          props.filter((name) => !mentions(page, name)),
          `${doc} props`
        ).toEqual([]);
      }
    }
    expect(readme).toContain('utm_source=dailybotopensource');
  });

  it('documents every class hook the stylesheet defines', () => {
    const css = read('src/styles.css');
    const hooks = new Set([...css.matchAll(/\.(tx-forms[\w-]*)/g)].map((m) => m[1] as string));
    expect(hooks.size).toBeGreaterThan(15);
    const page = read('docs/styles.md');
    expect([...hooks].filter((hook) => !page.includes(`.${hook}`))).toEqual([]);
  });

  it('states the release status honestly: published from 0.8.0, never the placeholder', () => {
    const manifest = JSON.parse(read('package.json')) as { version: string; private?: boolean };
    // First published in 0.8.0; the 0.0.0 placeholder is gone for good.
    expect(manifest.version).not.toBe('0.0.0');
    expect(manifest.private).toBe(true);
    expect(readme).toMatch(/Status: in development/);
    expect(readme).toMatch(/published on\s+(?:>\s+)?npm/);
    expect(readme).toContain(`\`${manifest.version}\``);
    expect(read('src/index.ts')).toContain(
      `export const FORMS_PACKAGE_VERSION = '${manifest.version}';`
    );
    const pages = [readme, ...readdirSync(`${ROOT}/docs`).map((file) => read(`docs/${file}`))];
    for (const page of pages)
      expect(page).not.toMatch(
        /not on npm yet|not published\s+(?:>\s+)?yet|0\.0\.0` placeholder|repository only|first release (?:is )?planned|unreleased/i
      );
  });

  it('keeps the model framework-free', () => {
    for (const file of readdirSync(`${ROOT}/src/model`)) {
      const source = read(`src/model/${file}`);
      expect(source, file).not.toMatch(/from 'svelte|from 'texuli|\.svelte'/);
    }
  });
});
