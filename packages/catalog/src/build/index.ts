/**
 * The catalog build (browser-safe): canonical JSON, content addressing and
 * emit tiers. Discovery and file writing live in `@texuli/catalog/build/node`.
 */
export {
  buildCatalog,
  CATALOG_FORMAT,
  CATALOG_VERSION,
  type Catalog,
  type CatalogBuild,
  CatalogBuildError,
  type CatalogEntry,
  catalogFileName,
  isTierU,
  type ManifestGroup,
  verifyCatalog,
} from './build.ts';
export { canonicalJson, sha256Hex } from './canonical.ts';
export {
  type CatalogEmitTier,
  CHROME_GROUPS,
  CONTENT_LAYOUT_IDS,
  emitTiers,
  isContentLayoutId,
  isOverlayId,
  isShellId,
} from './tiers.ts';
