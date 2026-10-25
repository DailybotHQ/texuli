import { buildCatalog } from '@texuli/catalog/build';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { DISPLAY_MANIFESTS } from '@texuli/catalog/manifests/display';
import { FORMS_MANIFESTS } from '@texuli/catalog/manifests/forms';
import { LAYOUTS_MANIFESTS } from '@texuli/catalog/manifests/layouts';
import { OVERLAYS_MANIFESTS } from '@texuli/catalog/manifests/overlays';

/**
 * The catalog build hash this site was built from (computed at build time),
 * so the chat island can refuse a service built from another catalog.
 */
export async function siteCatalogHash(): Promise<string> {
  const build = await buildCatalog([
    { name: 'content', manifests: CONTENT_MANIFESTS },
    { name: 'display', manifests: DISPLAY_MANIFESTS },
    { name: 'forms', manifests: FORMS_MANIFESTS },
    { name: 'layouts', manifests: LAYOUTS_MANIFESTS },
    { name: 'overlays', manifests: OVERLAYS_MANIFESTS },
  ]);
  return build.hash;
}
