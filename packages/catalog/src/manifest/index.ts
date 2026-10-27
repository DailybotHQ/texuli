/**
 * Catalog manifest format — build-time validation only.
 * The sink-free renderer must not import this subpath.
 */

export { manifestData } from './data.ts';
export type {
  CatalogDeprecation,
  CatalogEventName,
  CatalogExample,
  CatalogManifest,
  CatalogPropKind,
  CatalogPropSchema,
  CatalogTier,
  CatalogValueSchema,
  ManifestDiagnostic,
  ManifestPath,
  ManifestValidation,
} from './types.ts';
export {
  CATALOG_EVENT_NAMES,
  CATALOG_SCHEMA_REFS,
  CatalogManifestError,
  defineCatalogManifest,
  isCatalogManifest,
  MANIFEST_SCHEMA_VERSION,
  validateCatalogManifest,
  validateCatalogManifests,
} from './validate.ts';
