/**
 * `@texuli/spec/codegen` — build-time tooling: deterministic generation of
 * the manifests and the TypeScript and Kotlin projections, the catalog
 * projection, the committed-file JSON format and the conformance harness.
 * Pure functions: callers read and write the files.
 */

export {
  buildSpec,
  EXTERNAL_SCHEMAS,
  KOTLIN_OUT,
  NORMATIVE_DIRS,
  SCHEMA_UNITS,
  type SpecBuild,
  TS_OUT,
} from '../build.ts';
export { prettyJson } from '../canonical.ts';
export { type BuiltCatalogLike, projectCatalog } from '../catalog.ts';
export {
  type ConformanceIssue,
  checkCatalogContract,
  checkConformance,
  deprecationExpired,
} from '../conformance.ts';
export { formatJson, LINE_WIDTH } from '../format.ts';
export {
  checkVersionHistory,
  nextSpecVersion,
  type SpecChangeClass,
  type SpecVersionHistory,
  type SpecVersionPin,
  type VersionIssue,
} from '../versioning.ts';
export { KOTLIN_PACKAGE, kotlinProperty, kotlinString } from './kotlin.ts';
export type { SchemaUnit, Stamp } from './shared.ts';
