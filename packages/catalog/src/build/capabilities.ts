import type { Catalog } from './build.ts';

/**
 * Capability claims for the spec projection (`@texuli/spec`
 * `catalog/capabilities.json`). ADR-003: no id is `portable-core` until it is
 * audited and passes cross-target conformance, and a native binding never
 * promotes an id on its own.
 *
 * What the catalog can state as fact: an id the native Compose twin does not
 * bind (`native/texuli-compose` `NativeRegistry.implemented`) paints only on
 * the web, so it is `web-only`. Ids the twin does bind stay `unknown` until
 * the audit; they are listed here, and a test keeps the list equal to the
 * Kotlin registry.
 */
export const NATIVE_BOUND_IDS: readonly string[] = Object.freeze([
  'blocks-data',
  'blocks-diagram',
  'blocks-media',
  'blocks-text',
  'charts-bullet',
  'charts-gauge',
  'charts-progress-ring',
  'charts-sparkline',
  'deck-slide',
  'layout-card',
  'layout-deck',
  'layout-doc',
  'layout-grid',
  'layout-page',
  'media-image',
]);

export type CatalogCapabilityClaim = 'web-only';

/** `id → capability` for every catalog id with a known capability, sorted by id. */
export function catalogCapabilities(
  catalog: Pick<Catalog, 'entries'>
): Record<string, CatalogCapabilityClaim> {
  const native = new Set(NATIVE_BOUND_IDS);
  const out: Record<string, CatalogCapabilityClaim> = {};
  for (const entry of [...catalog.entries].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  )) {
    if (!native.has(entry.id)) out[entry.id] = 'web-only';
  }
  return out;
}
