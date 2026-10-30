// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every public subpath of @texuli/canvas has a docs page linked from the
 * README, and every name it exports and every component prop is mentioned
 * there, so new API cannot land undocumented. The framework-free subpaths
 * import no Svelte and no DOM framework, and sync takes only the CRDT core
 * from @texuli/document.
 */
const ROOT = 'packages/canvas';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');
const DOCS_URL = 'https://github.com/DailybotHQ/texuli/blob/main/packages/canvas';

const SUBPATH_DOCS: Record<string, { doc: string; entry: string; components?: string[] }> = {
  './model': { doc: 'docs/model.md', entry: 'src/model/index.ts' },
  './sync': { doc: 'docs/sync.md', entry: 'src/sync/index.ts' },
  './export': { doc: 'docs/export.md', entry: 'src/export/index.ts' },
  './editor': {
    doc: 'docs/editor.md',
    entry: 'src/editor/index.ts',
    components: ['src/editor/CanvasEditor.svelte'],
  },
  './viewer': {
    doc: 'docs/viewer.md',
    entry: 'src/viewer/index.ts',
    components: ['src/viewer/CanvasViewer.svelte'],
  },
  './host': { doc: 'docs/host.md', entry: 'src/host/index.ts' },
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

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(`${ROOT}/${dir}`, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sources(path));
    else if (/\.(ts|svelte)$/.test(entry.name)) out.push(path);
  }
  return out;
}

describe('canvas documentation', () => {
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
    expect(readme).toContain('`CANVAS_PACKAGE_VERSION`');
  });

  it('states the release status honestly: published from 0.8.0, never the placeholder', () => {
    const manifest = JSON.parse(read('package.json')) as { version: string; private?: boolean };
    // First published in 0.8.0; the 0.0.0 placeholder is gone for good.
    expect(manifest.version).not.toBe('0.0.0');
    expect(manifest.private).toBe(true);
    expect(readme).toMatch(/Status: in development/);
    expect(readme).toMatch(/published on\s+(?:>\s+)?npm/);
    expect(readme).toContain(`\`${manifest.version}\``);
    expect(readme).toContain('utm_source=dailybotopensource');
    expect(read('src/index.ts')).toContain(
      `export const CANVAS_PACKAGE_VERSION = '${manifest.version}';`
    );
    const pages = [readme, ...readdirSync(`${ROOT}/docs`).map((file) => read(`docs/${file}`))];
    for (const page of pages)
      expect(page).not.toMatch(
        /not on npm yet|not published\s+(?:>\s+)?yet|0\.0\.0` placeholder|repository only|first release (?:is )?planned|unreleased/i
      );
  });

  it('keeps the model, sync and export framework-free; sync takes only the CRDT core', () => {
    for (const file of [
      ...sources('src/model'),
      ...sources('src/sync'),
      ...sources('src/export'),
    ]) {
      const text = read(file);
      for (const [, specifier] of text.matchAll(/from '([^']+)'/g)) {
        expect(specifier, file).not.toMatch(/^svelte|^texuli|\.svelte$|editor|viewer/);
        if (specifier?.startsWith('@texuli/document'))
          expect(specifier, file).toBe('@texuli/document/sync');
      }
      expect(text, file).not.toMatch(
        /\bwindow\.|innerHTML|insertAdjacentHTML|\beval\(|new Function/
      );
    }
    for (const file of sources('src'))
      expect(read(file), file).not.toMatch(/\{@html|\.innerHTML\s*=|outerHTML\s*=/);
  });
});
