// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every public subpath has a docs page linked from the README, and every
 * name it exports, every stage component prop and every stylesheet hook is
 * mentioned in that page. New API cannot land undocumented.
 */
const ROOT = 'packages/slides';
const read = (path: string) => readFileSync(`${ROOT}/${path}`, 'utf8');

const SUBPATH_DOCS: Record<string, { doc: string; entry?: string }> = {
  './model': { doc: 'docs/model.md', entry: 'src/model/index.ts' },
  './grammar': { doc: 'docs/grammar.md', entry: 'src/grammar/index.ts' },
  './stage': { doc: 'docs/stage.md', entry: 'src/stage/index.ts' },
  './export': { doc: 'docs/export.md', entry: 'src/export/index.ts' },
  './templates': { doc: 'docs/templates.md', entry: 'src/templates/index.ts' },
  './styles.css': { doc: 'docs/styles.md' },
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

function propNames(component: string): string[] {
  const source = read(`src/stage/${component}.svelte`);
  const body = /interface Props \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
  return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1] as string);
}

describe('slides documentation', () => {
  const exportsMap = JSON.parse(read('package.json')).exports as Record<string, unknown>;
  const readme = read('README.md');

  it('maps every package subpath to a docs page', () => {
    const subpaths = Object.keys(exportsMap).filter((key) => key !== '.');
    expect(subpaths.sort()).toEqual(Object.keys(SUBPATH_DOCS).sort());
  });

  it.each(Object.entries(SUBPATH_DOCS))(
    '%s has a docs page linked from the README',
    (_subpath, { doc }) => {
      expect(existsSync(`${ROOT}/${doc}`), doc).toBe(true);
      expect(readme).toContain(`](${doc})`);
    }
  );

  it.each(Object.entries(SUBPATH_DOCS).filter(([, value]) => value.entry))(
    '%s documents every exported name',
    (_subpath, { doc, entry }) => {
      const page = read(doc);
      const missing = exportedNames(read(entry as string)).filter((name) => !mentions(page, name));
      expect(missing, `${doc} does not mention`).toEqual([]);
    }
  );

  it('documents every root export in the README or a docs page', () => {
    const all = [readme, ...Object.values(SUBPATH_DOCS).map(({ doc }) => read(doc))].join('\n');
    const missing = exportedNames(read('src/index.ts')).filter((name) => !mentions(all, name));
    expect(missing).toEqual([]);
  });

  it('documents every DeckStage and DeckPrint prop', () => {
    const page = read('docs/stage.md');
    for (const component of ['DeckStage', 'DeckPrint']) {
      const props = propNames(component);
      expect(props.length, component).toBeGreaterThan(3);
      expect(
        props.filter((prop) => !mentions(page, prop)),
        component
      ).toEqual([]);
    }
  });

  it('documents every stylesheet class hook and named page', () => {
    const css = read('src/styles.css');
    const page = read('docs/styles.md');
    const classes = [
      ...new Set([...css.matchAll(/\.(tx-deck-[a-z0-9_-]+)/g)].map((m) => m[1] as string)),
    ];
    const pages = [
      ...new Set([...css.matchAll(/@page (tx-deck-[a-z0-9-]+)/g)].map((m) => m[1] as string)),
    ];
    expect(classes.length).toBeGreaterThan(20);
    expect([...classes, ...pages].filter((name) => !page.includes(`\`${name}\``))).toEqual([]);
  });
});
