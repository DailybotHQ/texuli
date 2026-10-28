// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildCoverageMatrix,
  COMPONENT_PACKAGES,
  type ComponentExport,
  type CoverageInputs,
  type CoverageMatrix,
  collectCoverageInputs,
  renderMarkdown,
} from '../coverage-matrix.ts';

// Loader ids the player paints but the spec does not list (PLAN_007 baseline,
// "until the catalog adopts them"). The test asserts each is reported while it
// is missing; once T-catalog-coverage adopts one, it simply stops being a gap.
const PLAYER_ONLY_LOADER_IDS = [
  'action-form',
  'control-choice',
  'control-filter',
  'control-slider',
  'control-toggle',
  'flow-action',
  'flow-view',
  'form-field',
  'form-submit',
  'host-region',
  'layout-row',
  'layout-split',
  'layout-stack',
  'layout-tile',
];

// Components with no spec id today (board, tree view, calendar, chat).
const NO_SPEC_TODAY = [
  ['@texuli/data', 'Board'],
  ['@texuli/data', 'TreeDataView'],
  ['@texuli/data', 'CalendarView'],
  ['@texuli/chat', 'ChatThread'],
] as const;

let inputs: CoverageInputs;
let matrix: CoverageMatrix;

beforeAll(async () => {
  inputs = await collectCoverageInputs();
  matrix = buildCoverageMatrix(inputs);
}, 60_000);

describe('coverage matrix on the workspace', () => {
  it('lists components of every published component package', () => {
    const packages = COMPONENT_PACKAGES.map((pkg) => pkg.name).sort();
    expect(Object.keys(matrix.summary.perPackage).sort()).toEqual(packages);
    for (const pkg of packages) {
      expect(matrix.summary.perPackage[pkg], pkg).toBeGreaterThan(0);
      expect(matrix.rows.some((row) => row.package === pkg)).toBe(true);
    }
    for (const row of matrix.rows) expect(row.subpaths).toContain(row.subpath);
  });

  it('keeps the summary counts consistent with the rows and the gap lists', () => {
    const { summary, rows } = matrix;
    const c = summary.columns;
    const total = summary.components;
    const sum = (values: Record<string, number>) =>
      Object.values(values).reduce((acc, value) => acc + value, 0);

    expect(total).toBe(rows.length);
    expect(sum(summary.perPackage)).toBe(total);
    expect(sum(summary.perKind)).toBe(total);
    expect(c.catalogManifest + summary.gaps.componentsWithoutManifest.length).toBe(total);
    expect(c.specId + summary.gaps.componentsWithoutSpecId.length).toBe(total);
    expect(c.example + summary.gaps.componentsWithoutExample.length).toBe(total);
    expect(c.docs + summary.gaps.componentsWithoutDocs.length).toBe(total);
    expect(c.manifest - c.catalogManifest).toBe(
      summary.gaps.componentsWithPlayerManifestOnly.length
    );
    expect(c.capabilityKnown).toBeLessThanOrEqual(c.specId);
    expect(c.specId).toBeLessThanOrEqual(c.manifest);
    expect(c.loader).toBeLessThanOrEqual(c.manifest);

    const specIds = new Set(inputs.spec.map((entry) => entry.id));
    const loaderIds = new Set(inputs.loaders.map((loader) => loader.id));
    expect(summary.spec.ids).toBe(specIds.size);
    expect(sum(summary.spec.capabilities)).toBe(summary.spec.ids);
    expect(summary.loaders).toBe(loaderIds.size);
    expect(summary.gaps.loaderIdsWithoutSpecId).toEqual(
      [...loaderIds].filter((id) => !specIds.has(id)).sort()
    );
    expect(summary.gaps.specIdsWithoutLoader).toEqual(
      [...specIds].filter((id) => !loaderIds.has(id)).sort()
    );
    expect(summary.gaps.specIdsCapabilityUnknown).toEqual(
      inputs.spec
        .filter((entry) => entry.capability === 'unknown')
        .map((entry) => entry.id)
        .sort()
    );
    for (const id of summary.gaps.specIdsWithoutLoaderOrRenderer) {
      expect(summary.gaps.specIdsWithoutLoader).toContain(id);
      expect(summary.gaps.specIdsWithoutPlayerRenderer).toContain(id);
    }
  });

  it('reports the known gaps of today while they exist', () => {
    const specIds = new Set(inputs.spec.map((entry) => entry.id));
    const loaderIds = new Set(inputs.loaders.map((loader) => loader.id));
    for (const id of PLAYER_ONLY_LOADER_IDS) {
      expect(loaderIds.has(id), `${id} is a player loader`).toBe(true);
      if (!specIds.has(id)) expect(matrix.summary.gaps.loaderIdsWithoutSpecId).toContain(id);
    }
    for (const [pkg, name] of NO_SPEC_TODAY) {
      const row = matrix.rows.find((entry) => entry.package === pkg && entry.component === name);
      expect(row, `${pkg} ${name} is discovered`).toBeDefined();
      if (row?.specId === null) {
        expect(matrix.summary.gaps.componentsWithoutSpecId).toContain(`${pkg} ${name}`);
      } else {
        expect(specIds.has(row?.specId ?? '')).toBe(true);
      }
    }
    for (const id of matrix.summary.gaps.specIdsCapabilityUnknown) {
      expect(inputs.spec.find((entry) => entry.id === id)?.capability).toBe('unknown');
    }
  });

  it('renders a Markdown table per package', () => {
    const markdown = renderMarkdown(matrix);
    expect(markdown).toContain(`| Exported components | ${matrix.summary.components} `);
    for (const pkg of COMPONENT_PACKAGES) expect(markdown).toContain(`### ${pkg.name}\n`);
  });
});

describe('buildCoverageMatrix', () => {
  it('matches manifests by loader target, package loader map and name, and lists the gaps', () => {
    const component = (key: string, name: string, extra: Partial<ComponentExport> = {}) => ({
      key,
      package: 'pkg',
      subpaths: ['.', './x'],
      name,
      aliases: [name],
      kind: 'component' as const,
      file: `${key}.svelte`,
      paints: [],
      ...extra,
    });
    const fixture: CoverageInputs = {
      components: [
        component('a', 'AreaChart'),
        component('b', 'SelectContent', { aliases: ['SelectContent', 'Select.Content'] }),
        component('c', 'ThreadDisplay', { paints: ['chat-thread'] }),
        component('d', 'Orphan'),
      ],
      manifests: [
        {
          id: 'charts-area',
          package: 'pkg',
          label: 'Area',
          source: 'catalog',
          agentEmittable: true,
        },
        {
          id: 'select-content',
          package: 'pkg',
          label: 'Select.Content',
          source: 'catalog',
          agentEmittable: false,
        },
        {
          id: 'chat-thread',
          package: 'pkg',
          label: 'Chat thread',
          source: 'player',
          agentEmittable: true,
        },
        { id: 'ghost', package: 'pkg', label: 'Ghost', source: 'catalog', agentEmittable: false },
      ],
      spec: [
        { id: 'charts-area', label: 'Area', group: 'content', capability: 'portable' },
        { id: 'select-content', label: 'Select.Content', group: 'forms', capability: 'unknown' },
        { id: 'ghost', label: 'Ghost', group: 'display', capability: 'unknown' },
      ],
      loaders: [
        { id: 'charts-area', target: 'pkg/x#AreaChart', componentKey: 'a' },
        { id: 'player-only', target: './Only.svelte#default' },
      ],
      playerRendererIds: ['charts-area', 'chat-thread'],
      examples: [{ id: 'pkg-x', component: 'pkg/x' }],
      docs: [{ package: 'pkg', file: 'packages/pkg/docs/x.md', text: 'Use `Orphan`.' }],
    };
    const { rows, summary } = buildCoverageMatrix(fixture);
    const byName = new Map(rows.map((row) => [row.component, row]));

    expect(byName.get('AreaChart')).toMatchObject({
      subpath: './x',
      manifest: 'charts-area',
      specId: 'charts-area',
      capability: 'portable',
      loader: 'charts-area',
      renderer: ['catalog', 'player'],
      examples: ['pkg-x'],
      docs: 'packages/pkg/docs/x.md',
    });
    expect(byName.get('SelectContent')).toMatchObject({
      manifest: 'select-content',
      loader: null,
      renderer: ['catalog'],
    });
    expect(byName.get('ThreadDisplay')).toMatchObject({
      manifest: 'chat-thread',
      manifestSource: 'player',
      specId: null,
      packageLoader: 'chat-thread',
      renderer: ['player'],
    });
    expect(byName.get('Orphan')?.manifest).toBeNull();
    expect(summary.columns).toEqual({
      manifest: 3,
      catalogManifest: 2,
      specId: 2,
      capabilityKnown: 1,
      loader: 1,
      packageLoader: 1,
      renderer: 3,
      example: 4,
      docs: 4,
    });
    expect(summary.gaps).toEqual({
      componentsWithoutManifest: ['pkg Orphan', 'pkg ThreadDisplay'],
      componentsWithPlayerManifestOnly: ['pkg ThreadDisplay'],
      componentsWithoutSpecId: ['pkg Orphan', 'pkg ThreadDisplay'],
      componentsWithoutExample: [],
      componentsWithoutDocs: [],
      manifestsWithoutComponent: ['ghost (pkg, catalog)'],
      specIdsCapabilityUnknown: ['ghost', 'select-content'],
      loaderIdsWithoutSpecId: ['player-only'],
      specIdsWithoutLoader: ['ghost', 'select-content'],
      specIdsWithoutPlayerRenderer: ['ghost', 'select-content'],
      specIdsWithoutLoaderOrRenderer: ['ghost', 'select-content'],
    });
  });

  it('shares a loader-matched manifest with a same-named export of the same package only', () => {
    const component = (key: string, pkg: string, name: string, subpath: string) => ({
      key,
      package: pkg,
      subpaths: [subpath],
      name,
      aliases: [name],
      kind: 'component' as const,
      file: `${key}.svelte`,
      paints: [],
    });
    const fixture: CoverageInputs = {
      components: [
        component('compact', 'charts', 'Sparkline', './compact'),
        component('lite', 'charts', 'Sparkline', './sparkline-lite'),
        component('other-pkg', 'media', 'Sparkline', './x'),
        component('other-name', 'charts', 'SparkBar', './sparkline-lite'),
      ],
      manifests: [
        {
          id: 'charts-sparkline-x',
          package: 'charts',
          label: 'Trend line',
          source: 'catalog',
          agentEmittable: true,
        },
      ],
      spec: [],
      loaders: [
        { id: 'charts-sparkline-x', target: 'charts/compact#Sparkline', componentKey: 'compact' },
      ],
      playerRendererIds: [],
      examples: [],
      docs: [],
    };
    const { rows } = buildCoverageMatrix(fixture);
    const manifestOf = (file: string) => rows.find((row) => row.file === file)?.manifest;
    expect(manifestOf('compact.svelte')).toBe('charts-sparkline-x');
    expect(manifestOf('lite.svelte')).toBe('charts-sparkline-x');
    expect(manifestOf('other-pkg.svelte')).toBeNull();
    expect(manifestOf('other-name.svelte')).toBeNull();
  });
});
