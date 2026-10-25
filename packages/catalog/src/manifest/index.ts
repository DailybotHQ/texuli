/**
 * Catalog manifest format — build-time validation only.
 * The sink-free renderer must not import this subpath.
 */

export type {
  CatalogExample,
  CatalogManifest,
  CatalogPropKind,
  CatalogPropSchema,
  CatalogTier,
  ManifestDiagnostic,
  ManifestPath,
  ManifestValidation,
} from './types.ts';
export {
  CatalogManifestError,
  defineCatalogManifest,
  isCatalogManifest,
  MANIFEST_SCHEMA_VERSION,
  validateCatalogManifest,
  validateCatalogManifests,
} from './validate.ts';
