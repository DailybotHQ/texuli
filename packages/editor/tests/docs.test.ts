// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every public subpath has a docs page linked from the README, and every
 * name it exports and every prop of the editor components is mentioned in
 * that page. New API cannot land undocumented.
 */
const ROOT = 'packages/editor';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');
const DOCS_URL = 'https://github.com/DailybotHQ/texuli/blob/main/packages/editor';

const SUBPATH_DOCS: Record<string, { doc: string; entry: string }> = {
  './editor': { doc: 'docs/editor-surface.md', entry: 'src/editor/index.ts' },
  './toolbar': { doc: 'docs/editor-toolbar.md', entry: 'src/toolbar/index.ts' },
  './link-dialog': { doc: 'docs/editor-link-dialog.md', entry: 'src/link-dialog/index.ts' },
  './controller': { doc: 'docs/editor-controller.md', entry: 'src/controller/index.ts' },
  './markdown': { doc: 'docs/editor-markdown.md', entry: 'src/markdown/index.ts' },
  './paste': { doc: 'docs/editor-paste.md', entry: 'src/paste/index.ts' },
};

/** Svelte components and the page that documents their props. */
const COMPONENT_DOCS: Record<string, string> = {
  'src/editor/RichTextEditor.svelte': 'docs/editor-surface.md',
  'src/editor/EditorSurface.svelte': 'docs/editor-surface.md',
  'src/toolbar/EditorToolbar.svelte': 'docs/editor-toolbar.md',
  'src/link-dialog/LinkDialog.svelte': 'docs/editor-link-dialog.md',
};

/** Exported names of one module: `export { … }`, `export type { … }` and declarations. */
function exportedNames(source: string): string[] {
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
  return [...names].sort();
}

const mentions = (doc: string, name: string) => new RegExp(`\`${name}\\b`).test(doc);

/** Prop names of a component's `Props` type or interface. */
function propNames(path: string): string[] {
  const source = read(path);
  const body = /(?:type Props = \{|interface Props \{)([\s\S]*?)\n\};?/.exec(source)?.[1] ?? '';
  return [...body.matchAll(/^\s{2}'?([\w-]+)'?\??:/gm)].map((match) => match[1] as string);
}

describe('editor documentation', () => {
  const manifest = JSON.parse(read('package.json')) as {
    exports: Record<string, unknown>;
    private?: boolean;
    version: string;
  };
  const readme = read('README.md');

  it('maps every subpath to a linked docs page that documents every exported name', () => {
    const subpaths = Object.keys(manifest.exports).filter((key) => key !== '.');
    expect(subpaths.sort()).toEqual(Object.keys(SUBPATH_DOCS).sort());
    for (const [subpath, { doc, entry }] of Object.entries(SUBPATH_DOCS)) {
      expect(existsSync(`${ROOT}/${doc}`), doc).toBe(true);
      // npm renders the README off-repo, so it links docs by absolute URL.
      expect(readme, subpath).toContain(`](${DOCS_URL}/${doc})`);
      expect(readme, subpath).toContain(`\`@texuli/editor/${subpath.slice(2)}\``);
      const page = read(doc);
      const missing = exportedNames(read(entry)).filter((name) => !mentions(page, name));
      expect(missing, `${doc} does not mention`).toEqual([]);
    }
    // The root barrel's own exports are documented in the README or a page.
    const all = [readme, ...Object.values(SUBPATH_DOCS).map(({ doc }) => read(doc))].join('\n');
    const missing = exportedNames(read('src/index.ts')).filter((name) => !mentions(all, name));
    expect(missing).toEqual([]);
  });

  it('documents every component prop', () => {
    for (const [component, doc] of Object.entries(COMPONENT_DOCS)) {
      const props = propNames(component);
      expect(props.length, component).toBeGreaterThan(2);
      const page = read(doc);
      expect(
        props.filter((prop) => !mentions(page, prop)),
        `${doc} does not mention props of ${component}`
      ).toEqual([]);
    }
  });

  it('states the release status honestly', () => {
    // Publishable (packed by scripts/packages.ts); first published as 0.5.0.
    expect(readme).not.toMatch(/never packed|excluded from packing/i);
    if (manifest.version === '0.0.0') {
      expect(readme).toMatch(/not on npm yet/i);
      expect(readme).toMatch(/0\.0\.0/);
    } else {
      // A released version: the README names it and no longer says unpublished.
      expect(readme).not.toMatch(/not on npm yet|0\.0\.0` placeholder/i);
      expect(readme).toContain(`\`${manifest.version}\``);
    }
    // The exported constant tracks the manifest version.
    expect(read('src/index.ts')).toContain(
      `export const EDITOR_PACKAGE_VERSION = '${manifest.version}';`
    );
  });
});
