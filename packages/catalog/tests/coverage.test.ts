// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildCoverageMatrix,
  type ComponentExport,
  type CoverageInputs,
  collectCoverageInputs,
  discoverComponents,
  ExportResolver,
} from '../../../scripts/coverage-matrix.ts';
import { buildCatalog, catalogCapabilities, NATIVE_BOUND_IDS } from '../src/build/index.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import {
  CATALOG_EXCLUSIONS,
  type CatalogExclusion,
  EXCLUSION_CEILING,
} from './coverage-exclusions.ts';

/**
 * The catalog coverage gate (ADR-008): every exported Svelte component of
 * texuli, data, charts, media, chat, blocks and workflows has a catalog
 * manifest, or a reasoned row in `coverage-exclusions.ts`. Components are
 * discovered from each package's `exports` by the coverage-matrix script
 * (`scripts/coverage-matrix.ts`), which also matches manifests to
 * components (player loader target, package loader map, then name).
 */

const ROOT = new URL('../../../', import.meta.url).pathname;
const EXTRA_PACKAGES = ['@texuli/workflows'];

export interface CoverageFindings {
  /** Exported components with neither a manifest nor an exclusion. */
  uncovered: string[];
  /** Exclusions whose component has a manifest now, or no longer exists. */
  stale: string[];
  /** Duplicate or unreasoned rows. */
  malformed: string[];
}

/** The gate as a pure function of the matrix inputs and the exclusion list. */
export function checkCoverage(
  inputs: CoverageInputs,
  exclusions: readonly CatalogExclusion[]
): CoverageFindings {
  const matrix = buildCoverageMatrix({
    ...inputs,
    // Player-held manifests do not count: the catalog is the vocabulary.
    manifests: inputs.manifests.filter((manifest) => manifest.source === 'catalog'),
  });
  const keyOf = (row: { package: string; component: string }) => `${row.package}::${row.component}`;
  const rows = new Map(matrix.rows.map((row) => [keyOf(row), row]));
  const excluded = new Map<string, CatalogExclusion>();
  const malformed: string[] = [];
  for (const exclusion of exclusions) {
    if (excluded.has(exclusion.key)) malformed.push(`${exclusion.key}: listed twice`);
    if (exclusion.reason.trim().length < 10) malformed.push(`${exclusion.key}: needs a reason`);
    excluded.set(exclusion.key, exclusion);
  }
  const uncovered = matrix.rows
    .filter((row) => row.manifest === null && !excluded.has(keyOf(row)))
    .map((row) => `${keyOf(row)} (${row.file})`);
  const stale = [...excluded.keys()].filter((key) => {
    const row = rows.get(key);
    return row === undefined || row.manifest !== null;
  });
  return { uncovered, stale, malformed };
}

const inputs: Promise<CoverageInputs> = (async () => {
  const collected = await collectCoverageInputs(ROOT);
  const resolver = new ExportResolver(ROOT);
  for (const pkg of EXTRA_PACKAGES) collected.components.push(...discoverComponents(resolver, pkg));
  return collected;
})();

describe('catalog coverage gate', () => {
  it('every exported component has a manifest or a reasoned, current exclusion', {
    timeout: 120_000,
  }, async () => {
    const findings = checkCoverage(await inputs, CATALOG_EXCLUSIONS);
    expect(
      findings.uncovered,
      'add a manifest (or, for a part, chrome or utility, an exclusion row)'
    ).toEqual([]);
    expect(findings.stale, 'remove the row and lower EXCLUSION_CEILING').toEqual([]);
    expect(findings.malformed).toEqual([]);
  });

  it('the exclusion list only shrinks', () => {
    expect(CATALOG_EXCLUSIONS.length).toBeLessThanOrEqual(EXCLUSION_CEILING);
    // Keep the ceiling tight: lower it in the same change that removes a row.
    expect(CATALOG_EXCLUSIONS.length).toBe(EXCLUSION_CEILING);
  });

  it('fails on an injected unmanifested export and passes without it (controlled pair)', {
    timeout: 120_000,
  }, async () => {
    const real = await inputs;
    const injected: ComponentExport = {
      key: 'texuli::packages/texuli/src/injected/InjectedWidget.svelte',
      package: 'texuli',
      subpaths: ['./injected'],
      name: 'InjectedWidget',
      aliases: ['InjectedWidget'],
      kind: 'component',
      file: 'packages/texuli/src/injected/InjectedWidget.svelte',
      paints: [],
    };
    const without = checkCoverage(real, CATALOG_EXCLUSIONS);
    const withIt = checkCoverage(
      { ...real, components: [...real.components, injected] },
      CATALOG_EXCLUSIONS
    );
    expect(without.uncovered).toEqual([]);
    expect(withIt.uncovered).toEqual([
      'texuli::InjectedWidget (packages/texuli/src/injected/InjectedWidget.svelte)',
    ]);
    // A stale row is caught too: exclude something that has a manifest.
    const stale = checkCoverage(real, [
      ...CATALOG_EXCLUSIONS,
      { key: 'texuli::Button', kind: 'planned', reason: 'A deliberately stale row.' },
    ]);
    expect(stale.stale).toEqual(['texuli::Button']);
  });

  it('covers the data views, chat, workflows and the state surfaces by manifest', {
    timeout: 120_000,
  }, async () => {
    const build = await buildCatalog(await discoverManifestGroups());
    const groups = build.catalog.groups;
    expect(groups.data).toEqual([
      'data-board',
      'data-calendar',
      'data-cohort-table',
      'data-files',
      'data-filter-builder',
      'data-grid',
      'data-map',
      'data-notification-inbox',
      'data-timeline',
      'data-tree-view',
    ]);
    expect(groups.chat).toEqual(['chat-message', 'chat-thread']);
    expect(groups.workflows).toEqual(['workflow-graph']);
    // The 14 ids the player painted without a catalog manifest are adopted.
    for (const id of [
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
    ]) {
      expect(
        build.catalog.entries.some((entry) => entry.id === id),
        id
      ).toBe(true);
    }
  });
});

describe('capability claims', () => {
  it('every id is web-only unless the native twin binds it (those stay unknown until audited)', async () => {
    const build = await buildCatalog(await discoverManifestGroups());
    const claims = catalogCapabilities(build.catalog);
    const ids = build.catalog.entries.map((entry) => entry.id);
    expect(Object.keys(claims).length + NATIVE_BOUND_IDS.length).toBe(ids.length);
    for (const id of NATIVE_BOUND_IDS) {
      expect(ids, id).toContain(id);
      expect(claims[id]).toBeUndefined();
    }
    expect(new Set(Object.values(claims))).toEqual(new Set(['web-only']));
  });

  it('NATIVE_BOUND_IDS equals the Compose registry', () => {
    const kotlin = readFileSync(
      new URL(
        '../../../native/texuli-compose/src/commonMain/kotlin/com/texuli/compose/Registry.kt',
        import.meta.url
      ),
      'utf8'
    );
    const implemented =
      /val implemented: Set<String> = setOf\(([\s\S]*?)\)/.exec(kotlin)?.[1] ?? '';
    const charts = /compactCharts = setOf\(([^)]*)\)/.exec(kotlin)?.[1] ?? '';
    const names = [...`${implemented}${charts}`.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect([...new Set(names)].sort()).toEqual([...NATIVE_BOUND_IDS]);
  });
});
