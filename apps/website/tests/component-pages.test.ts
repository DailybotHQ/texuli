// @vitest-environment node
/**
 * Component pages (T-81): every page keeps its live stage, examples, editable
 * controls and guidance sections (a page that loses one fails here instead of
 * silently thinning); every family has its differentiator note; the theme
 * strip shows real library themes; and stage seeds keep live demos from
 * repeating a landmark name the page chrome owns (axe `landmark-unique`: the
 * live Breadcrumb once rendered as "Breadcrumb" beside the docs-shell trail).
 *
 * The other reference pages are pinned at their data the same way: the
 * primitives reference (every subpath once, anatomy parts that are real
 * exports, behavior evidence parsed from the committed scenarios, a lazy demo
 * island on every page) and the blocks page (each install command names
 * exactly the components its source imports, all of them addable).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPEN_TO_FOCUS_P75_MS,
  OPEN_TO_FOCUS_P75_MS,
} from '../../../tests/behavior/harness/limits.ts';
import { importedTexuliIds, PAGE_BLOCKS } from '../src/components/blocks-page/blocks.ts';
import { FAMILY_NOTES, familyNote } from '../src/components/component-pages/family-notes.ts';
import {
  a11yLines,
  COMPONENT_PAGES,
  componentPagesByGroup,
} from '../src/components/component-pages/load-manifests.ts';
import {
  libraryThemeCount,
  loadStripThemes,
  STRIP_THEME_IDS,
  STRIP_VARS,
  stripVarsStyle,
} from '../src/components/component-pages/themes-sample.ts';
import { initialProps } from '../src/components/live/props-state.ts';
import {
  PAGE_STAGE_SEEDS,
  STAGE_CONTROLS,
  seededExampleProps,
} from '../src/components/live/stage-controls.ts';
import { stageFor } from '../src/components/live/stage-map.ts';
import {
  behaviorEvidence,
  parseBehaviorChecks,
  parseBehaviorRows,
  parseOpenToFocusLimits,
} from '../src/components/primitives-page/behavior.ts';
import {
  anatomyParts,
  importLine,
  PRIMITIVES,
  partLabel,
} from '../src/components/primitives-page/primitives.ts';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const readSource = (fromSrc: string) => readFileSync(resolve(srcDir, fromSrc), 'utf8');
const EDITABLE = new Set(['string', 'number', 'boolean', 'enum']);

describe('component pages', () => {
  it('every page keeps a stage, an example, valid controls, guidance and a family note', () => {
    expect(COMPONENT_PAGES.length).toBeGreaterThan(100);
    const groups = [...componentPagesByGroup().keys()].sort();
    expect(groups).toEqual(['content', 'display', 'forms', 'layouts', 'overlays']);
    expect(Object.keys(FAMILY_NOTES).sort()).toEqual(groups);
    expect(familyNote('not-a-group')).toBeUndefined();

    for (const entry of COMPONENT_PAGES) {
      const id = `"${entry.id}"`;
      const stage = stageFor(entry.id);
      expect(stage?.from, `${id} has no stage`).toContain('/');
      expect(entry.examples.length, `${id} lost its examples`).toBeGreaterThanOrEqual(1);
      expect(Object.hasOwn(STAGE_CONTROLS, entry.id), `${id} not in STAGE_CONTROLS`).toBe(true);
      const editable = new Set(
        entry.props.filter((prop) => EDITABLE.has(prop.kind)).map((prop) => prop.name)
      );
      for (const control of STAGE_CONTROLS[entry.id] ?? []) {
        expect(editable.has(control), `${id} controls non-editable "${control}"`).toBe(true);
      }
      expect(entry.useWhen.length, `${id} has no useWhen`).toBeGreaterThanOrEqual(1);
      expect(entry.dontUseWhen.length, `${id} has no dontUseWhen`).toBeGreaterThanOrEqual(1);
      expect(a11yLines(entry.a11y).length, `${id} has empty a11y notes`).toBeGreaterThanOrEqual(1);
      expect(familyNote(entry.group)?.headline, `${id} has no family note`).toBeTruthy();
    }
  });

  it('the theme strip shows the curated library themes with real engine token values', async () => {
    const themes = await loadStripThemes();
    expect(themes.map((theme) => theme.id)).toEqual([...STRIP_THEME_IDS]);
    expect(new Set(STRIP_THEME_IDS).size).toBe(3);
    for (const theme of themes) {
      expect(theme.name).not.toBe(theme.id);
      expect(['AA', 'AAA']).toContain(theme.contrastLevel);
      for (const name of STRIP_VARS) {
        const value = theme.vars[name];
        expect(value, `${theme.id} misses ${name}`).toBeTruthy();
        if (name === '--tx-radius') expect(value, `${theme.id} ${name}`).toMatch(/(rem|px)$/);
        else expect(value, `${theme.id} ${name}`).toMatch(/^#/);
      }
    }
    expect(new Set(themes.map((theme) => theme.mode))).toEqual(new Set(['light', 'dark']));
    expect(await libraryThemeCount()).toBeGreaterThanOrEqual(210);
    expect(stripVarsStyle({ '--tx-background': '#ffffff', '--tx-radius': '0.5rem' })).toBe(
      '--tx-background:#ffffff;--tx-radius:0.5rem'
    );
  });

  it('stage seeds rename the live Breadcrumb away from the page trail, and examples still win', () => {
    expect(readSource('layouts/BaseLayout.astro')).toContain(
      '<nav class="crumbs" aria-label="Breadcrumb"'
    );
    expect(readSource('components/component-pages/ComponentPageBody.astro')).toContain(
      'props: seededExampleProps(entry.id, example.props)'
    );
    const breadcrumb = COMPONENT_PAGES.find((entry) => entry.id === 'breadcrumb');
    const first = breadcrumb?.examples[0];
    if (!breadcrumb || !first) throw new Error('the breadcrumb page lost its first example');
    expect(breadcrumb.props.find((prop) => prop.name === 'label')?.default).toBe('Breadcrumb');
    const schema = breadcrumb.props
      .filter((prop) => EDITABLE.has(prop.kind))
      .map((prop) => ({
        name: prop.name,
        kind: prop.kind,
        ...(prop.enumValues ? { enumValues: prop.enumValues } : {}),
        ...(prop.default !== undefined ? { default: prop.default } : {}),
      }));
    const values = initialProps(schema, {
      id: first.id,
      title: first.title,
      props: seededExampleProps('breadcrumb', first.props),
    });
    expect(values.label).toBe('Project breadcrumb');
    expect(values.items).toEqual(first.props.items);
    expect(seededExampleProps('breadcrumb', { label: 'Trail' })).toEqual({ label: 'Trail' });
    expect(seededExampleProps('button', { size: 'sm' })).toEqual({ size: 'sm' });

    for (const [id, seed] of Object.entries(PAGE_STAGE_SEEDS)) {
      const entry = COMPONENT_PAGES.find((page) => page.id === id);
      expect(entry?.examples.length ?? 0, id).toBeGreaterThanOrEqual(1);
      for (const name of Object.keys(seed))
        expect(STAGE_CONTROLS[id], `${id}.${name}`).toContain(name);
    }
  });
});

// ── the primitives reference ─────────────────────────────────────────────

const REPO = resolve(srcDir, '../../..');
const PRIMITIVES_SRC = join(REPO, 'packages/primitives/src');
const SCENARIOS = join(REPO, 'tests/behavior/scenarios');

/** Name → its keys (a compound object or `export * as`), or null for a plain export. */
type Exports = Map<string, Set<string> | null>;

/** The top-level keys of the object literal that starts at `open` (`{`). */
function objectKeys(text: string, open: number): Set<string> {
  let depth = 0;
  let end = open;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const keys = new Set<string>();
  let level = 0;
  let entry = '';
  for (const char of `${text.slice(open + 1, end)},`) {
    if ('{([<'.includes(char)) level += 1;
    if ('})]>'.includes(char)) level -= 1;
    if (char === ',' && level === 0) {
      const key = entry
        .replace(/\/\/.*$/gm, '')
        .trim()
        .split(':')[0]
        ?.trim();
      if (key && /^\w+$/.test(key)) keys.add(key);
      entry = '';
    } else entry += char;
  }
  return keys;
}

/** Where the value of `export const NAME` starts: past its type, at the `=`. */
function valueStart(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const char = text[i];
    if ('{(<['.includes(char ?? '')) depth += 1;
    else if ('})>]'.includes(char ?? '') && text[i - 1] !== '=') depth -= 1;
    else if (char === '=' && depth === 0 && text[i + 1] !== '>') return i + 1;
  }
  return text.length;
}

/** A subpath's exports, read from its source (re-exports followed). */
function moduleExports(file: string, seen = new Set<string>()): Exports {
  const exports: Exports = new Map();
  if (seen.has(file) || !existsSync(file)) return exports;
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  const near = (spec: string) => resolve(dirname(file), spec);
  for (const match of text.matchAll(/export const (\w+)/g)) {
    const start = valueStart(text, (match.index ?? 0) + match[0].length);
    const brace = text.slice(start).search(/\S/);
    const rest = text.slice(start + brace);
    const object = /^(Object\.freeze\(\s*)?\{/.exec(rest);
    exports.set(
      match[1] as string,
      object ? objectKeys(text, start + brace + object[0].length - 1) : null
    );
  }
  for (const match of text.matchAll(/export (?:function|class) (\w+)/g)) {
    exports.set(match[1] as string, null);
  }
  for (const match of text.matchAll(/export (type )?\{([^}]*)\}/g)) {
    if (match[1]) continue;
    for (const item of (match[2] ?? '').split(',')) {
      const name = item.trim();
      if (!name || name.startsWith('type ')) continue;
      exports.set(
        name
          .split(/\s+as\s+/)
          .pop()
          ?.trim() as string,
        null
      );
    }
  }
  for (const match of text.matchAll(/export \* as (\w+) from '([^']+)'/g)) {
    exports.set(match[1] as string, new Set(moduleExports(near(match[2] as string), seen).keys()));
  }
  for (const match of text.matchAll(/export \* from '([^']+)'/g)) {
    for (const [name, keys] of moduleExports(near(match[1] as string), seen)) {
      exports.set(name, keys);
    }
  }
  return exports;
}

function resolvesTo(exports: Exports, part: string): boolean {
  const [head, key] = part.split('.') as [string, string | undefined];
  if (!exports.has(head)) return false;
  if (key === undefined) return true;
  return exports.get(head)?.has(key) ?? false;
}

describe('primitives reference', () => {
  it('documents every @texuli/primitives subpath once, with anatomy parts that are real exports', () => {
    const manifest = JSON.parse(
      readFileSync(join(REPO, 'packages/primitives/package.json'), 'utf8')
    ) as { exports: Record<string, unknown> };
    const subpaths = Object.keys(manifest.exports)
      .filter((key) => key !== '.')
      .map((key) => key.slice(2))
      .sort();
    expect(PRIMITIVES.map((doc) => doc.id)).toEqual(subpaths);

    const missing: string[] = [];
    for (const doc of PRIMITIVES) {
      const exports = moduleExports(join(PRIMITIVES_SRC, doc.id, 'index.ts'));
      expect(exports.size, doc.id).toBeGreaterThan(0);
      for (const part of anatomyParts(doc.anatomy)) {
        if (!resolvesTo(exports, part)) missing.push(`${doc.id}: ${part}`);
      }
    }
    expect(missing).toEqual([]);

    const dialog = PRIMITIVES.find((doc) => doc.id === 'dialog');
    const tooltip = PRIMITIVES.find((doc) => doc.id === 'tooltip');
    if (!dialog || !tooltip) throw new Error('missing fixtures');
    expect(importLine(dialog)).toBe("import * as Dialog from '@texuli/primitives/dialog';");
    expect(partLabel(dialog, 'Content')).toBe('Dialog.Content');
    expect(importLine(tooltip)).toBe("import { Tooltip } from '@texuli/primitives/tooltip';");
  });

  it('parses every committed scenario and the open-to-focus limits exactly as the suite defines them', () => {
    const files = readdirSync(SCENARIOS).filter((file) => file.endsWith('.spec.ts'));
    expect(files.length).toBeGreaterThan(30);
    for (const file of files) {
      const source = readFileSync(join(SCENARIOS, file), 'utf8');
      const evidence = behaviorEvidence(file.replace('.spec.ts', ''), source);
      if (evidence.kind === 'rows') {
        const rows = source.match(/^\s+id:\s*['"]/gm)?.length ?? 0;
        expect(evidence.rows, file).toHaveLength(rows);
        for (const row of evidence.rows) expect(row.title, `${file} ${row.id}`).not.toBe('');
      } else {
        expect(evidence.kind, file).toBe('checks');
        if (evidence.kind === 'checks') expect(evidence.checks.length, file).toBeGreaterThan(0);
      }
    }
    expect(
      parseOpenToFocusLimits(readFileSync(join(REPO, 'tests/behavior/harness/limits.ts'), 'utf8'))
    ).toEqual({ defaultMs: DEFAULT_OPEN_TO_FOCUS_P75_MS, byPrimitive: OPEN_TO_FOCUS_P75_MS });

    // Concatenated titles and escaped quotes.
    expect(
      parseBehaviorRows(`defineRows([
        { id: 'one', title: "it's " + 'open', async run({ page }) { await page.evaluate(() => ({ title: 'not this' })); } },
        { id: 'two', title: 'plain \\'escaped\\' row', run: async () => {} },
      ]);`)
    ).toEqual([
      { id: 'one', title: "it's open" },
      { id: 'two', title: "plain 'escaped' row" },
    ]);
    expect(
      parseBehaviorChecks("test('a check', async () => {}); test.describe('x', () => {});")
    ).toEqual(['a check']);
    expect(behaviorEvidence('ghost', undefined).kind).toBe('missing');
  });

  it('every primitive page hydrates its live demo only when visible', () => {
    const page = readSource('pages/primitives-page/[id].astro');
    expect(page).toMatch(/<LiveDemo client:visible id=\{doc\.id\}/);
    expect(page).not.toMatch(/<LiveDemo client:(load|idle)/);
  });
});

describe('blocks page', () => {
  it('each install command names exactly the components its source imports, all of them addable', () => {
    const registry = readFileSync(join(REPO, 'packages/tools/src/cli-add/registry.ts'), 'utf8');
    const addable = new Set(
      [...registry.matchAll(/texuliComponent\('([\w-]+)'/g)].map((m) => m[1])
    );
    expect(addable.size).toBeGreaterThan(5);
    for (const block of PAGE_BLOCKS) {
      const source = readSource(`components/blocks-page/sections/${block.file}`);
      expect(importedTexuliIds(source), block.id).toEqual([...block.add].sort());
      for (const id of block.add)
        expect(addable.has(id), `${block.id}: texuli add ${id}`).toBe(true);
    }
  });
});
