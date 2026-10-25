/**
 * `@texuli/spec` — the schema-first blueprint contract (spec/Compose design
 * B1), runtime half: the generated types and vocabulary, the dialect
 * validator, the target-neutral blueprint validator and deterministic
 * hashing. Build-time generation and the conformance harness live in
 * `@texuli/spec/codegen`. Framework-free: no DOM, no Svelte and no Node APIs.
 */

export type * from '../generated/typescript/blueprint.ts';
export type * from '../generated/typescript/catalog-schema.ts';
export type * from '../generated/typescript/diagnostics.ts';
export type * from '../generated/typescript/manifest.ts';
export {
  SPEC_CATALOG_HASH,
  SPEC_COMPONENT_IDS,
  type SpecComponentId,
  type SpecComponentProps,
} from '../generated/typescript/vocabulary.ts';
export { canonicalJson, sha256 } from './canonical.ts';
export {
  CAPABILITIES,
  type Capability,
  type SpecPropKind,
  WEB_ONLY_KINDS,
  WEB_ONLY_PROP_NAMES,
} from './catalog.ts';
export {
  checkSchemaDocument,
  DIALECT_KEYWORDS,
  DIALECT_TYPES,
  DIALECT_URI,
  type DialectType,
  type Schema,
  type SchemaIssue,
  validateInstance,
} from './dialect.ts';
export {
  type SpecDocuments,
  validateBlueprint,
  validateTree,
} from './validate.ts';
export { SPEC_VERSION } from './version.ts';
