/**
 * @texuli/deck/schema: the owned schema kit (ADR-009, model-v2 §2.1 option B).
 *
 * Combinators are data: `t.*` builds frozen plain objects describing a shape,
 * `validate` walks them (all issues, `DeckDiagnostic` with `jsonPath` and
 * RFC 6901 `pointer`, capped at 200, never throws), `toJsonSchema` writes
 * JSON Schema 2020-12 from the same data, and `Infer<typeof S>` gives the
 * TypeScript type. String lengths count Unicode code points everywhere.
 */
export {
  type CodeOptions,
  type Described,
  JSON_DEFAULTS,
  type JsonOptions,
  type LazyOptions,
  type NumberOptions,
  type ObjectOptions,
  type OptionalOptions,
  objectOf,
  type RecordOptions,
  type RefineOptions,
  type SizeOptions,
  type StringOptions,
  t,
  UNSAFE_KEYS,
  type UnionOptions,
} from './builders.ts';
export {
  createDiagnostic,
  type DeckDiagnostic,
  type DiagnosticExtra,
  type DiagnosticSeverity,
  type DiagnosticSource,
  formatDiagnostic,
  MAX_DIAGNOSTICS,
  type PathSegment,
  SCHEMA_CODES,
  type SchemaCode,
  toJsonPath,
  toPointer,
} from './diagnostics.ts';
export { codePointLength, unsafeTextIndex } from './internal.ts';
export {
  JSON_SCHEMA_DIALECT,
  type JsonSchema,
  type JsonSchemaOptions,
  toJsonSchema,
} from './json-schema.ts';
export type {
  ArraySchema,
  BooleanSchema,
  EnumSchema,
  Infer,
  InferShape,
  JsonValue,
  JsonValueSchema,
  LazySchema,
  LiteralSchema,
  LiteralValue,
  NullableSchema,
  NullSchema,
  NumberSchema,
  ObjectSchema,
  OptionalSchema,
  RecordSchema,
  RefineContext,
  RefineIssue,
  RefineSchema,
  Schema,
  SchemaKind,
  SchemaNode,
  Shape,
  StringSchema,
  TextMode,
  UnionSchema,
} from './types.ts';
export {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES,
  is,
  type SchemaNormalization,
  type ValidateOptions,
  type ValidateResult,
  validate,
} from './validate.ts';
