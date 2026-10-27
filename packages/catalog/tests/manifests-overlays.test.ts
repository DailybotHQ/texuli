// @vitest-environment node
import { readdir } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { buildCatalog } from '../src/build/index.ts';
import { discoverManifestGroups, MANIFESTS_DIR } from '../src/build/node.ts';
import {
  isCatalogManifest,
  validateCatalogManifest,
  validateCatalogManifests,
} from '../src/manifest/index.ts';
import {
  type dialogPropNames,
  OVERLAYS_MANIFESTS,
  OVERLAYS_PROP_NAMES,
  type OverlaysManifestId,
} from '../src/manifests/overlays/index.ts';

/** Assert schema prop names equal the canonical list (order-insensitive). */
function expectPropsMatch(manifestId: OverlaysManifestId, names: readonly string[]): void {
  const manifest = OVERLAYS_MANIFESTS.find((entry) => entry.id === manifestId);
  expect(manifest, `missing manifest ${manifestId}`).toBeDefined();
  const schemaNames = manifest!.props.map((prop) => prop.name).sort();
  expect(schemaNames).toEqual([...names].sort());
}

it('overlay manifests are a closed, frozen, never-emittable set with schema parity, discovered without a build change', async () => {
  // validates every overlay/navigation manifest as a closed set
  {
    const result = validateCatalogManifests(OVERLAYS_MANIFESTS);
    expect(result.diagnostics, JSON.stringify(result.diagnostics, null, 2)).toEqual([]);
    expect(result.valid).toBe(true);
    expect(OVERLAYS_MANIFESTS.length).toBe(Object.keys(OVERLAYS_PROP_NAMES).length);
    expect(new Set(OVERLAYS_MANIFESTS.map((m) => m.id)).size).toBe(OVERLAYS_MANIFESTS.length);
  }
  for (const manifest of OVERLAYS_MANIFESTS) {
    expect(isCatalogManifest(manifest)).toBe(true);
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(manifest.package).toBe('texuli');
    expect(manifest.tier).toBe('app');
    expect(manifest.agentEmittable).toBe(false);
    expect(manifest.useWhen.length).toBeGreaterThan(0);
    expect(manifest.dontUseWhen.length).toBeGreaterThan(0);
    expect(manifest.examples.length).toBeGreaterThan(0);
    expect(validateCatalogManifest(manifest).valid).toBe(true);
  }
  for (const [id, names] of Object.entries(OVERLAYS_PROP_NAMES)) {
    expectPropsMatch(id as OverlaysManifestId, names);
  }
  // documents Dialog props used by Dialog.svelte
  {
    type DialogProp = (typeof dialogPropNames)[number];
    const required: DialogProp[] = [
      'open',
      'title',
      'description',
      'size',
      'trigger',
      'footer',
      'children',
      'hideClose',
      'closeLabel',
      'onOpenChange',
      'class',
    ];
    expect(required).toEqual([...OVERLAYS_PROP_NAMES.dialog]);
  }
  // rejects unknown example props against the schema
  {
    const dialog = OVERLAYS_MANIFESTS.find((m) => m.id === 'dialog')!;
    const broken = {
      ...dialog,
      examples: [{ id: 'x', title: 'X', props: { notAProp: true } }],
    };
    const result = validateCatalogManifest(broken);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'unknown-prop')).toBe(true);
  }
  // appears in discoverManifestGroups without changing the catalog build
  {
    const folders = (await readdir(MANIFESTS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(folders).toEqual(expect.arrayContaining(['overlays']));

    const groups = await discoverManifestGroups();
    expect(groups.map((group) => group.name)).toEqual(folders);

    const overlays = groups.find((group) => group.name === 'overlays');
    expect(overlays).toBeDefined();
    expect(overlays!.manifests.length).toBe(OVERLAYS_MANIFESTS.length);
    expect(overlays!.manifests.map((m) => m.id).sort()).toEqual(
      OVERLAYS_MANIFESTS.map((m) => m.id).sort()
    );

    const build = await buildCatalog(groups);
    expect(build.catalog.groups.overlays).toEqual(OVERLAYS_MANIFESTS.map((m) => m.id).sort());
    // Chrome group: never in Tier U even if someone flipped agentEmittable.
    for (const id of build.catalog.groups.overlays ?? []) {
      expect(build.catalog.tiers.untrusted).not.toContain(id);
    }
  }
});
