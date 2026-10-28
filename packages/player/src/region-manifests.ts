import type { CatalogManifest } from '@texuli/catalog/manifest';
import { hostRegionManifest } from '@texuli/catalog/manifests/state';
import type { GrammarComponentMeta } from '@texuli/catalog/render/grammar';

/**
 * Host-owned regions (player design R21; audit G18, dispatched as Task 62).
 * A `host-region` node reserves a named place in the blueprint. The host
 * mounts its own component there (payment, sign-in), the player passes it
 * no blueprint data, and the blueprint never sees what the host renders. A
 * name the host does not provide paints the label as an inert placeholder.
 * The manifest lives in the player until the catalog adopts it.
 */
export const HOST_REGION_ID = 'host-region';

/** A region name: lowercase, digits and hyphens, at most 32 characters. */
export const HOST_REGION_NAME = /^[a-z][a-z0-9-]{0,31}$/;

export function isHostRegionName(value: unknown): value is string {
  return typeof value === 'string' && HOST_REGION_NAME.test(value);
}

/** The manifest lives in the catalog's `state` group (ADR-008). */
export { hostRegionManifest };

export const REGION_MANIFESTS: readonly CatalogManifest[] = Object.freeze([hostRegionManifest]);

/** A host region is interactive in the grammar: it never nests inside another interactive node. */
export const REGION_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  { id: HOST_REGION_ID, role: 'interactive' },
]);
