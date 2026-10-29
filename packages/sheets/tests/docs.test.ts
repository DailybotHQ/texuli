// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHEET_FUNCTION_NAMES } from '../src/formula/index.ts';

/**
 * Every public subpath of @texuli/sheets has a docs page linked from the
 * README, and every name it exports, every SheetView prop and every sheet
 * function is mentioned there, so new API cannot land undocumented. The
 * formula, model and csv subpaths import no Svelte and no DOM framework.
 */
const ROOT = 'packages/sheets';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');
const DOCS_URL = 'https://github.com/DailybotHQ/texuli/blob/main/packages/sheets';

const SUBPATH_DOCS: Record<string, { doc: string; entry: string; components?: string[] }> = {
  './formula': { doc: 'docs/formula.md', entry: 'src/formula/index.ts' },
  './model': { doc: 'docs/model.md', entry: 'src/model/index.ts' },
  './csv': { doc: 'docs/csv.md', entry: 'src/csv/index.ts' },
  './host': { doc: 'docs/host.md', entry: 'src/host/index.ts' },
  './view': {
    doc: 'docs/view.md',
    entry: 'src/view/index.ts',
    components: ['src/view/SheetView.svelte'],
  },
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
  ))
    if (match[1]) names.add(match[1]);
  for (const match of source.matchAll(/export\s+\*\s+from\s+'(\.[^']+)'/g)) {
    for (const name of exportedNames(join(dirname(path), match[1] as string), seen))
      names.add(name);
  }
  return [...names].sort();
}

const mentions = (doc: string, name: string) => new RegExp(`\`${name}\\b`).test(doc);

function propNames(component: string): string[] {
  const body = /interface Props[^{]*\{([\s\S]*?)\n\}/.exec(read(component))?.[1] ?? '';
  return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1] as string);
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sources(path));
    else if (/\.(ts|svelte)$/.test(entry.name)) out.push(path);
  }
  return out;
}

describe('sheets documentation', () => {
  const exportsMap = JSON.parse(read('package.json')).exports as Record<string, unknown>;
  const readme = read('README.md');

  it('maps every subpath to a linked page that documents every export and component prop', () => {
    expect(
      Object.keys(exportsMap)
        .filter((key) => key !== '.')
        .sort()
    ).toEqual(Object.keys(SUBPATH_DOCS).sort());
    for (const [subpath, { doc, entry, components }] of Object.entries(SUBPATH_DOCS)) {
      expect(existsSync(`${ROOT}/${doc}`), doc).toBe(true);
      expect(readme, subpath).toContain(`](${DOCS_URL}/${doc})`);
      const page = read(doc);
      const names = exportedNames(entry);
      expect(names.length, entry).toBeGreaterThan(0);
      expect(
        names.filter((name) => !mentions(page, name)),
        `${doc} does not mention`
      ).toEqual([]);
      for (const component of components ?? []) {
        const props = propNames(component);
        expect(props.length, component).toBeGreaterThan(5);
        expect(
          props.filter((name) => !mentions(page, name)),
          `${doc} props`
        ).toEqual([]);
      }
    }
    expect(readme).toContain('`SHEETS_PACKAGE_VERSION`');
  });

  it('documents every sheet function with its signature', () => {
    const page = read('docs/formula.md');
    expect(SHEET_FUNCTION_NAMES.filter((name) => !mentions(page, `${name}`))).toEqual([]);
    expect(page).toContain(`the ${SHEET_FUNCTION_NAMES.length} functions`);
    expect(readme).toContain(`${SHEET_FUNCTION_NAMES.length} documented functions`);
  });

  it('states the release status honestly: the placeholder until a release publishes it', () => {
    const manifest = JSON.parse(read('package.json')) as { version: string; private?: boolean };
    expect(manifest.version).toBe('0.0.0');
    expect(manifest.private).toBe(true);
    expect(readme).toMatch(/Status: in development/);
    expect(readme).toMatch(/not on npm yet/);
    expect(readme).toContain('utm_source=dailybotopensource');
    expect(read('src/index.ts')).toContain(
      `export const SHEETS_PACKAGE_VERSION = '${manifest.version}';`
    );
  });

  it('keeps formula, model and csv framework-free and every source sink-free', () => {
    for (const file of [
      ...sources('src/formula'),
      ...sources('src/model'),
      ...sources('src/csv'),
    ]) {
      const text = read(file);
      for (const [, specifier] of text.matchAll(/from '([^']+)'/g)) {
        expect(specifier, file).not.toMatch(/^svelte|^texuli|^@texuli\/data|\.svelte$|view/);
      }
      expect(text, file).not.toMatch(
        /\bwindow\.|innerHTML|insertAdjacentHTML|\beval\(|new Function/
      );
    }
    for (const file of sources('src'))
      expect(read(file), file).not.toMatch(/\{@html|\.innerHTML\s*=|outerHTML\s*=/);
  });
});
