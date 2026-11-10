/**
 * Catalog manifest format — build-time validation only.
 * The sink-free renderer must not import this subpath.
 */

export { manifestData } from './data.ts';
export { CATALOG_PART_PARENTS, partParentMap } from './parts.ts';
export type {
  CatalogAxisName,
  CatalogDeprecation,
  CatalogEventName,
  CatalogExample,
  CatalogImport,
  CatalogManifest,
  CatalogPropKind,
  CatalogPropSchema,
  CatalogStateName,
  CatalogTier,
  CatalogValueSchema,
  ManifestDiagnostic,
  ManifestPath,
  ManifestValidation,
} from './types.ts';
export {
  CATALOG_AXIS_NAMES,
  CATALOG_EVENT_NAMES,
  CATALOG_SCHEMA_REFS,
  CATALOG_STATE_NAMES,
  CatalogManifestError,
  defineCatalogManifest,
  isCatalogManifest,
  MANIFEST_SCHEMA_VERSION,
  validateCatalogManifest,
  validateCatalogManifests,
} from './validate.ts';
