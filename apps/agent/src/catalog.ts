import { buildCatalog, type CatalogBuild } from '@texuli/catalog/build';
import { ALL_MANIFEST_GROUPS } from '@texuli/catalog/manifests/all';

let cached: Promise<CatalogBuild> | undefined;

/**
 * The built catalog, from the static manifest list of
 * `@texuli/catalog/manifests/all`, so the edge worker needs no file system.
 * That list is checked against `discoverManifestGroups()` in the catalog
 * package (and again in `tests/tools-catalog.test.ts`), so the hash matches
 * the site's `catalog-<sha256>.json`. Built once.
 */
export function loadCatalog(): Promise<CatalogBuild> {
  cached ??= buildCatalog(ALL_MANIFEST_GROUPS);
  return cached;
}
