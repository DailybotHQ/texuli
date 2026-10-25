// @vitest-environment node
import { readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildCatalog, isContentLayoutId, isTierU } from '../src/build/index.ts';
import { discoverManifestGroups, MANIFESTS_DIR } from '../src/build/node.ts';
import {
  isCatalogManifest,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';
import {
  LAYOUTS_MANIFESTS,
  LAYOUTS_PROP_NAMES,
  type LayoutsManifestId,
  type layoutHostPropNames,
} from '../src/manifests/layouts/index.ts';

/** Assert schema prop names equal the canonical list (order-insensitive). */
function expectPropsMatch(manifestId: LayoutsManifestId, names: readonly string[]): void {
  const manifest = LAYOUTS_MANIFESTS.find((entry) => entry.id === manifestId);
  expect(manifest, `missing manifest ${manifestId}`).toBeDefined();
  const schemaNames = manifest!.props.map((prop) => prop.name).sort();
  expect(schemaNames).toEqual([...names].sort());
}

describe('layouts manifests', () => {
  it('validates every layout/shell manifest as a closed set', () => {
    const result = validateCatalogManifests(LAYOUTS_MANIFESTS);
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.valid).toBe(true);
    expect(LAYOUTS_MANIFESTS.length).toBe(Object.keys(LAYOUTS_PROP_NAMES).length);
    expect(new Set(LAYOUTS_MANIFESTS.map((m) => m.id)).size).toBe(LAYOUTS_MANIFESTS.length);
  });

  it('keeps app shells frozen and never agent-emittable; content layouts emittable', () => {
    const contentIds = new Set([
      'layout-card',
      'layout-page',
      'layout-doc',
      'layout-deck',
      'layout-grid',
      'deck-slide',
    ]);
    for (const manifest of LAYOUTS_MANIFESTS) {
      expect(isCatalogManifest(manifest)).toBe(true);
      expect(Object.isFrozen(manifest)).toBe(true);
      expect(manifest.package).toBe('texuli');
      expect(manifest.useWhen.length).toBeGreaterThan(0);
      expect(manifest.dontUseWhen.length).toBeGreaterThan(0);
      expect(manifest.examples.length).toBeGreaterThan(0);
      expect(validateCatalogManifest(manifest).valid).toBe(true);

      if (contentIds.has(manifest.id)) {
        expect(manifest.tier).toBe('content');
        expect(manifest.agentEmittable).toBe(true);
        expect(isContentLayoutId(manifest.id)).toBe(true);
      } else {
        expect(manifest.tier).toBe('app');
        expect(manifest.agentEmittable).toBe(false);
      }
    }
  });

  it('matches each component prop surface to its schema (type parity)', () => {
    for (const [id, names] of Object.entries(LAYOUTS_PROP_NAMES)) {
      expectPropsMatch(id as LayoutsManifestId, names);
    }
  });

  it('documents LayoutHost props used by LayoutHost.svelte', () => {
    type HostProp = (typeof layoutHostPropNames)[number];
    const required: HostProp[] = [
      'layout',
      'children',
      'nav',
      'path',
      'options',
      'storageKey',
      'aside',
      'dir',
      'loadingLabel',
      'class',
    ];
    expect(required).toEqual([...LAYOUTS_PROP_NAMES['layout-host']]);
  });

  it('rejects unknown example props against the schema', () => {
    const host = LAYOUTS_MANIFESTS.find((m) => m.id === 'layout-host')!;
    const broken = {
      ...host,
      examples: [{ id: 'x', title: 'X', props: { notAProp: true } }],
    };
    const result = validateCatalogManifest(broken);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'unknown-prop')).toBe(true);
  });

  it('appears in discoverManifestGroups without changing the catalog build', async () => {
    const folders = (await readdir(MANIFESTS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(folders).toEqual(expect.arrayContaining(['layouts', 'overlays']));

    const groups = await discoverManifestGroups();
    expect(groups.map((group) => group.name)).toEqual(folders);

    const layouts = groups.find((group) => group.name === 'layouts');
    expect(layouts).toBeDefined();
    expect(layouts!.manifests.length).toBe(LAYOUTS_MANIFESTS.length);
    expect(layouts!.manifests.map((m) => m.id).sort()).toEqual(
      LAYOUTS_MANIFESTS.map((m) => m.id).sort()
    );

    const build = await buildCatalog(groups);
    expect(build.catalog.groups.layouts).toEqual(LAYOUTS_MANIFESTS.map((m) => m.id).sort());

    // Content composition layouts land in Tier U.
    for (const id of ['layout-card', 'layout-page', 'layout-doc', 'layout-deck', 'layout-grid']) {
      expect(isTierU(build.catalog, id)).toBe(true);
      expect(build.catalog.tiers.untrusted).toContain(id);
    }

    // App shells / chrome layouts never land in Tier U.
    for (const id of [
      'layout-host',
      'layout-sidebar',
      'layout-chrome',
      'layout-drawer',
      'split-view',
      'layout-settings',
    ]) {
      expect(build.catalog.tiers.untrusted).not.toContain(id);
    }
  });
});
