// @vitest-environment node
import { buildCatalog } from '@texuli/catalog/build';
import { discoverManifestGroups } from '@texuli/catalog/build/node';
import { describe, expect, it } from 'vitest';
import { createPlayerCatalog } from '../src/catalog.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { CATALOG_GROUPS } from './catalog-groups.ts';

/**
 * Loader parity (ADR-008): every agent-emittable catalog id has a painter,
 * every painter names a catalog id, and the ids the player does not paint
 * are not agent-emittable, each group with its reason. The spec projects
 * the same built catalog (`@texuli/spec` keeps components.json equal to it).
 */

/** Why non-emittable ids of a group have no painter. Shrink as groups gain painters. */
export const NOT_PAINTED: Readonly<Record<string, string>> = Object.freeze({
  overlays:
    'Overlays, menus and focus traps are never agent-emittable (ADR-001): the host composes them in code.',
  layouts:
    'App shells and host layouts route screens: host composition, not blueprint data. The content layouts are painted.',
  forms:
    'Planned: form inputs become emittable once audited with spec 0.3.0 bind and on; action-form and form-field paint forms today.',
  display:
    'Planned: app-tier display components (button, badge, alert…) become emittable once audited; blocks-* paint content today.',
});

const build = await buildCatalog(await discoverManifestGroups());
const entries = build.catalog.entries;
const loaderIds = Object.keys(PLAYER_LOADERS);

describe('player loader parity', () => {
  it('the explicit group list (DOM tests) equals the discovered groups', async () => {
    const discovered = await discoverManifestGroups();
    const ids = (groups: readonly { name: string; manifests: readonly { id: string }[] }[]) =>
      groups.map((group) => [group.name, group.manifests.map((m) => m.id).sort()]);
    expect(ids(CATALOG_GROUPS)).toEqual(ids(discovered));
  });

  it('every agent-emittable id has a painter', () => {
    const missing = entries
      .filter((e) => e.agentEmittable && !loaderIds.includes(e.id))
      .map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it('every painter names a catalog id', () => {
    const ids = new Set(entries.map((e) => e.id));
    expect(loaderIds.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every id without a painter is non-emittable, in a group with a reason', () => {
    const unpainted = entries.filter((e) => !loaderIds.includes(e.id));
    for (const entry of unpainted) {
      expect(entry.agentEmittable, entry.id).not.toBe(true);
      expect(NOT_PAINTED[entry.group], `${entry.id} (${entry.group})`).toBeTruthy();
    }
    // Every reason still covers at least one id (the map only shrinks).
    for (const group of Object.keys(NOT_PAINTED)) {
      expect(
        unpainted.some((entry) => entry.group === group),
        group
      ).toBe(true);
    }
  });

  it('the player catalog accepts every painted id with its events and bindable props', () => {
    const catalog = createPlayerCatalog();
    for (const id of loaderIds) expect(catalog.get(id), id).toBeTruthy();
    expect(catalog.get('data-board')?.bindable).toEqual(['items']);
    expect(catalog.get('sortable-list')?.events).toEqual(['move']);
  });
});
