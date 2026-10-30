import { buildCatalog } from '@texuli/catalog/build';
import { COMPOSITION_MANIFESTS } from '@texuli/catalog/manifests/composition';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { LAYOUTS_MANIFESTS } from '@texuli/catalog/manifests/layouts';
import { type RenderCatalog, renderCatalogFromBuild } from '@texuli/catalog/render/renderer';

/**
 * The catalog email drafts are validated against: the content families,
 * the content layouts and the composition layouts. An id outside it is
 * refused by `validateDraft` before the email mapping sees it.
 */
const EMAIL_CATALOG_BUILD = await buildCatalog([
  { name: 'content', manifests: CONTENT_MANIFESTS },
  { name: 'layouts', manifests: LAYOUTS_MANIFESTS },
  { name: 'composition', manifests: COMPOSITION_MANIFESTS },
]);

export function emailRenderCatalog(): RenderCatalog {
  return renderCatalogFromBuild(EMAIL_CATALOG_BUILD.catalog);
}
