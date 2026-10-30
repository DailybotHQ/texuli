/**
 * `@texuli/spec` — the schema-first blueprint contract (spec/Compose design
 * B1), runtime half: the generated types and vocabulary, the dialect
 * validator, the target-neutral blueprint validator, the 0.3.0 interaction
 * contract (bindings, closed actions, events) and deterministic hashing.
 * Opt-in subpaths keep the root small: `@texuli/spec/workflow` (the workflow
 * graph validator, passed in `SpecDocuments.validateWorkflowGraph`) and
 * `@texuli/spec/migrate` (envelope migrations). Build-time generation and the
 * conformance harness live in `@texuli/spec/codegen`. Framework-free: no DOM,
 * no Svelte and no Node APIs.
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
export type * from '../generated/typescript/workflow.ts';
export { canonicalJson, sha256 } from './canonical.ts';
export {
  CAPABILITIES,
  type Capability,
  type SpecPropKind,
  WEB_ONLY_KINDS,
  WEB_ONLY_PROP_NAMES,
} from './catalog.ts';
export {
  ACTION_FIELDS,
  contractRoot,
  DATA_BINDING_KEY,
  SPEC_ACTION_OPS,
  SPEC_EVENT_NAMES,
  SPEC_LIMITS,
  SPEC_PATTERNS,
  SPEC_PROP_REFS,
  SPEC_STATE_TYPES,
  type SpecActionOp,
  type SpecStateType,
  STATE_BINDING_KEY,
  STATE_FIELDS,
  toDialectSchema,
} from './contract.ts';
export {
  checkSchemaDocument,
  DIALECT_KEYWORDS,
  DIALECT_TYPES,
  DIALECT_URI,
  type DialectHooks,
  type DialectType,
  type Schema,
  type SchemaIssue,
  validateInstance,
} from './dialect.ts';
export type { SpecMigration, SpecMigrationResult } from './migrations/types.ts';
export {
  checkSourceBinding,
  isSourceBinding,
  isSpecSourceDate,
  SOURCE_BINDING_FIELDS,
  SOURCE_BINDING_KEY,
  type SourceBindingContext,
  type SourceBindingIssue,
  SPEC_SOURCE_FIELD_TYPES,
  SPEC_SOURCE_FILTER_OPERATORS,
  SPEC_SOURCE_LIMITS,
  SPEC_SOURCE_OPERATIONS,
  SPEC_SOURCE_PATTERNS,
  type SpecSourceDescriptor,
  type SpecSourceField,
  type SpecSourceFieldType,
  type SpecSourceFilterOperator,
  type SpecSourceOperation,
} from './source.ts';
export {
  checkStateSurface,
  LIST_TEXT_PATTERN,
  SPEC_CONTROL_STATE_TYPES,
  SURFACE_PLAYER_CODES,
  type SurfaceCode,
  type SurfaceInputs,
  type SurfaceIssue,
  surfaceInputs,
} from './surface.ts';
export {
  type SpecDocuments,
  type SpecFlowInfo,
  type SpecStateVariable,
  type TreeOptions,
  validateBlueprint,
  validateTree,
  type WorkflowGraphValidator,
} from './validate.ts';
export { SPEC_VERSION } from './version.ts';
