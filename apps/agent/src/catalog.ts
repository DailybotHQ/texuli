import { buildCatalog, type CatalogBuild } from '@texuli/catalog/build';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { DISPLAY_MANIFESTS } from '@texuli/catalog/manifests/display';
import { FORMS_MANIFESTS } from '@texuli/catalog/manifests/forms';
import { LAYOUTS_MANIFESTS } from '@texuli/catalog/manifests/layouts';
import { OVERLAYS_MANIFESTS } from '@texuli/catalog/manifests/overlays';

let cached: Promise<CatalogBuild> | undefined;

/**
 * The built catalog, from statically imported manifest groups, so the edge
 * worker needs no file system. Same groups and names as the catalog CLI, so
 * the hash matches the site's `catalog-<sha256>.json` (tested). Built once.
 */
export function loadCatalog(): Promise<CatalogBuild> {
  cached ??= buildCatalog([
    { name: 'content', manifests: CONTENT_MANIFESTS },
    { name: 'display', manifests: DISPLAY_MANIFESTS },
    { name: 'forms', manifests: FORMS_MANIFESTS },
    { name: 'layouts', manifests: LAYOUTS_MANIFESTS },
    { name: 'overlays', manifests: OVERLAYS_MANIFESTS },
  ]);
  return cached;
}
