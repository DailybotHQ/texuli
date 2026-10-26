import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAYERS as GUARD_LAYERS } from '../../../scripts/check-layers.ts';
import {
  ARCH_LAYERS,
  ARCH_LAYERS_DESCENDING,
  dependencySummary,
  LADDER_STAGES,
  LAYER_EDGES,
  shortName,
} from '../src/components/sections/architecture/layers-data.ts';

/**
 * T-49 unit gate for the layer-graph and texel-ladder sections. The vitest
 * suite cannot compile .astro templates, so these tests pin the data module
 * against its two sources of truth and the section templates as source:
 *
 *  1. the layer data is a faithful transcription of the layer table in
 *     docs/ARCHITECTURE.md — same rows, same order, same roles, same
 *     workspace dependencies — and every package's layer number equals the
 *     guard's `LAYERS` in scripts/check-layers.ts;
 *  2. the graph is down-only (every dependency target sits on a lower
 *     layer) and the derived edge list matches the rows;
 *  3. the template keeps the a11y contract: the diagram is a decorative
 *     duplicate hidden from assistive technology, the table alternative has
 *     caption and scoped headers, and the only focusable element is the
 *     keyboard-scrollable table region;
 *  4. the ladder is a real ordered list whose runtime notes anchor to the
 *     files that state them;
 *  5. CSS themes through --tx-* tokens with logical properties only.
 */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`repository root not found from ${process.cwd()}`);
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const read = (relativePath: string): string =>
  readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
/** Collapse whitespace, drop backticks — wrapped sources compare as prose. */
const normalize = (text: string): string => text.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();

const doc = read('docs/ARCHITECTURE.md');
const graphSection = read('apps/website/src/components/sections/architecture/LayerGraph.astro');
const ladderSection = read('apps/website/src/components/sections/architecture/TexelLadder.astro');

interface DocRow {
  label: string;
  name: string;
  role: string;
  dependsOn: string[];
}

/** The layer table rows of docs/ARCHITECTURE.md, in document order. */
function parseDocRows(): DocRow[] {
  const section = doc.slice(doc.indexOf('## The layer graph'), doc.indexOf('## Package subpaths'));
  const rows: DocRow[] = [];
  for (const line of section.split('\n')) {
    const cells = line
      .trim()
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 4 || !/^L\d+$/.test(cells[0] ?? '')) continue;

    const [label, packageCell, role, dependencyCell] = cells as [string, string, string, string];
    const name = /^`([^`]+)`$/.exec(packageCell)?.[1];
    if (!name) continue;

    // Dependencies are plain text (`core, tokens`), unlike the package
    // column's code span. Parse that cell independently so adjacent table
    // separators cannot be consumed as part of a regex capture.
    const dependsOn =
      dependencyCell === 'none'
        ? []
        : dependencyCell
            .split(',')
            .map((dependency) => dependency.trim())
            .filter(Boolean);
    rows.push({ label, name, role, dependsOn });
  }
  return rows;
}

const DOC_ROWS = parseDocRows();
const DATA_PACKAGES = ARCH_LAYERS.flatMap((layer) =>
  layer.packages.map((pkg) => ({ label: layer.label, ...pkg }))
);

describe('the layer data is a faithful transcription of docs/ARCHITECTURE.md', () => {
  it('the doc table parses to rows (the cross-check cannot silently pass)', () => {
    expect(DOC_ROWS.length).toBeGreaterThanOrEqual(16);
    expect(DOC_ROWS[0]).toMatchObject({ label: 'L0', name: '@texuli/core' });
  });

  it('lists exactly the doc rows, in the doc order', () => {
    expect(DATA_PACKAGES.map((pkg) => [pkg.label, pkg.name])).toEqual(
      DOC_ROWS.map((row) => [row.label, row.name])
    );
  });

  it.each(DOC_ROWS.map((row, index) => [`${row.label} ${row.name}`, row, index] as const))(
    '%s matches the doc cell word for word, dependencies included',
    (_title, row, index) => {
      const pkg = DATA_PACKAGES[index];
      expect(pkg.label).toBe(row.label);
      expect(normalize(pkg.role)).toBe(normalize(row.role));
      expect(pkg.dependsOn).toEqual(row.dependsOn);
    }
  );

  it('renders the dependency column exactly as the doc spells it (none included)', () => {
    const tokens = ARCH_LAYERS.flatMap((layer) => layer.packages).find(
      (pkg) => pkg.name === '@texuli/tokens'
    );
    expect(tokens?.dependsOn).toEqual([]);
    const core = ARCH_LAYERS.flatMap((layer) => layer.packages).find(
      (pkg) => pkg.name === '@texuli/core'
    );
    expect(core?.dependsOn).toEqual([]);
    expect(dependencySummary({ level: 0, label: 'L0', packages: core ? [core] : [] })).toContain(
      'no workspace dependencies'
    );
  });
});

describe('the layer data agrees with the enforced guard (scripts/check-layers.ts)', () => {
  it('names exactly the packages the guard layers', () => {
    expect(new Set(DATA_PACKAGES.map((pkg) => pkg.name))).toEqual(
      new Set(Object.keys(GUARD_LAYERS))
    );
  });

  it.each(DATA_PACKAGES.map((pkg) => [pkg.name, pkg.label] as const))(
    '%s sits on %s in the guard too',
    (name, label) => {
      expect(GUARD_LAYERS[name]).toBe(Number(label.slice(1)));
    }
  );
});

describe('the graph is down-only, and the derived edges follow the rows', () => {
  const layerOf = new Map(DATA_PACKAGES.map((pkg) => [pkg.name, Number(pkg.label.slice(1))]));

  it('every dependency points to a strictly lower layer', () => {
    for (const pkg of DATA_PACKAGES) {
      const own = layerOf.get(pkg.name);
      expect(own).toBeDefined();
      for (const dep of pkg.dependsOn) {
        const target = layerOf.get(dep === 'texuli' ? 'texuli' : `@texuli/${dep}`);
        expect(target, `${pkg.name} depends on ${dep}`).toBeDefined();
        expect(target).toBeLessThan(own as number);
      }
    }
  });

  it('derives one deduplicated edge list from the same rows', () => {
    const expected = new Set<string>();
    for (const pkg of DATA_PACKAGES) {
      const own = layerOf.get(pkg.name) as number;
      for (const dep of pkg.dependsOn) {
        const target = layerOf.get(dep === 'texuli' ? 'texuli' : `@texuli/${dep}`) as number;
        expected.add(`${own}->${target}`);
      }
    }
    const actual = new Set(LAYER_EDGES.map((edge) => `${edge.from}->${edge.to}`));
    expect(actual).toEqual(expected);
    for (const edge of LAYER_EDGES) expect(edge.to).toBeLessThan(edge.from);
  });
});

describe('layer-graph template: the table is the text alternative', () => {
  it('is one labelled section landmark named by its h2', () => {
    const sections = graphSection.match(/<section[^>]*>/g) ?? [];
    expect(sections).toHaveLength(1);
    expect(sections[0]).toContain('aria-labelledby={titleId}');
    expect(graphSection).toContain('const titleId = ');
    expect(graphSection).toContain('<h2 id={titleId}>');
  });

  it('hides the decorative band diagram from assistive technology', () => {
    expect(graphSection).toContain('class="arch-layers__diagram" aria-hidden="true"');
    expect(graphSection).toContain('dependencies point down only');
  });

  it('gives the graph a real table alternative with caption and scoped headers', () => {
    expect(graphSection).toContain('<table class="arch-layers__table">');
    expect(graphSection).toMatch(/<caption>\s*The layer graph as a table:/);
    expect((graphSection.match(/scope="col"/g) ?? []).length).toBe(4);
    expect(graphSection).toContain('<th scope="row">{layer.label}</th>');
  });

  it('offers no interactive nodes: the only focusable element is the table region', () => {
    expect(graphSection).not.toContain('<button');
    expect(graphSection).not.toContain('<a ');
    expect((graphSection.match(/tabindex/g) ?? []).length).toBe(1);
    expect(graphSection).toMatch(
      /role="region" aria-label="The layer graph as a table" tabindex="0"/
    );
  });

  it('keeps heading order h2 with no skipped levels', () => {
    const levels = [...graphSection.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['2']);
  });

  it('renders the descending band order (L8 on top, L0 at the bottom)', () => {
    expect(graphSection).toContain('ARCH_LAYERS_DESCENDING.map(');
    expect(ARCH_LAYERS_DESCENDING[0]?.label).toBe('L8');
    expect(ARCH_LAYERS_DESCENDING.at(-1)?.label).toBe('L0');
  });
});

describe('the texel ladder: three rungs, anchored notes', () => {
  it('walks texels → primitives → components, in order', () => {
    expect(LADDER_STAGES.map((stage) => stage.name)).toEqual([
      'texels',
      'primitives',
      'components',
    ]);
  });

  it('places each rung in the package the doc puts it in', () => {
    expect(LADDER_STAGES.map((stage) => [stage.home, stage.layer])).toEqual([
      ['@texuli/core', 'L0'],
      ['@texuli/primitives', 'L1'],
      ['texuli', 'L3'],
    ]);
    for (const stage of LADDER_STAGES) {
      expect(existsSync(resolve(REPO_ROOT, 'packages', shortName(stage.home)))).toBe(true);
    }
  });

  const notes = LADDER_STAGES.flatMap((stage) => [
    { name: stage.name, side: 'web', ...stage.runtimes.web },
    { name: stage.name, side: 'native', ...stage.runtimes.native },
  ]);

  it.each(notes.map((note) => [note] as const))(
    '$name ($side) anchors every phrase it cites',
    (note) => {
      expect(note.text.trim().length).toBeGreaterThan(0);
      for (const source of note.sources) {
        expect(normalize(read(source.file))).toContain(normalize(source.phrase));
        expect(normalize(note.text)).toContain(normalize(source.phrase));
      }
    }
  );

  it('annotates both runtimes for every rung', () => {
    for (const stage of LADDER_STAGES) {
      expect(stage.runtimes.web.text).toMatch(/web|Svelte|Ships|Runs/);
      expect(stage.runtimes.native.text).toMatch(/native|Compose|Kotlin/);
    }
  });

  it('renders the ladder as a real ordered list with h2 → h3 order', () => {
    expect(ladderSection).toContain('<ol class="arch-ladder__list">');
    expect(ladderSection).toContain('<h3>{stage.name}</h3>');
    const levels = [...ladderSection.matchAll(/<h([1-6])\b/g)].map((match) => match[1]);
    expect(levels).toEqual(['2', '3']);
  });
});

describe('shared template and CSS contract', () => {
  it.each([graphSection, ladderSection])('uses no HTML sinks anywhere', (template) => {
    expect(template).not.toContain('{@html');
    expect(template).not.toContain('set:html');
    expect(template).not.toContain('innerHTML');
  });

  it('names the enforcing guard in the graph copy', () => {
    expect(graphSection).toContain('scripts/check-layers.ts');
  });

  it.each([
    ['LayerGraph.astro', graphSection],
    ['TexelLadder.astro', ladderSection],
  ])('%s styles through --tx-* tokens, logical properties only', (_name, template) => {
    const style = template.slice(template.lastIndexOf('<style>'));
    const tokens = new Set(style.match(/--tx-[a-z0-9-]+/g) ?? []);
    expect(tokens.size).toBeGreaterThanOrEqual(5);
    expect(style).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(style).not.toMatch(/rgba?\(/);
    expect(style).toMatch(/var\(--tx-/);
    expect(style).toMatch(/inline-size/);
    expect(style).toMatch(/padding-block/);
    for (const physical of [
      /[^-]margin-left:/,
      /[^-]margin-right:/,
      /[^-]padding-left:/,
      /[^-]padding-right:/,
      /text-align:\s*(left|right)/,
      /float:/,
    ]) {
      expect(physical.test(style)).toBe(false);
    }
  });

  it.each([
    ['LayerGraph.astro', graphSection],
    ['TexelLadder.astro', ladderSection],
  ])('%s holds the forced-colors and narrow-viewport contracts', (_name, template) => {
    const style = template.slice(template.lastIndexOf('<style>'));
    expect(style).toMatch(/@media \(forced-colors: active\)/);
    expect(style).toMatch(/@media \(min-width: 56rem\)|@media \(max-width: 22\.5rem\)/);
  });
});
