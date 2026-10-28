/**
 * Schema nodes are plain frozen data (`kind` plus options). These types give
 * each node its output type through a phantom, type-only property, so
 * `Infer<typeof S>` reads the TypeScript type straight off a schema value.
 */
import type { DiagnosticSeverity, PathSegment } from './diagnostics.ts';

/** Type-only brand; it never exists at runtime. */
declare const OUTPUT: unique symbol;

export type SchemaKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'literal'
  | 'enum'
  | 'array'
  | 'object'
  | 'record'
  | 'union'
  | 'nullable'
  | 'optional'
  | 'lazy'
  | 'refine'
  | 'json';

/** Any schema whose validated output is `T`. */
export interface Schema<T = unknown> {
  readonly kind: SchemaKind;
  readonly description?: string;
  readonly [OUTPUT]?: T;
}

/** The output type of a schema value: `type Deck = Infer<typeof DeckSchema>`. */
export type Infer<S> = S extends Schema<infer T> ? T : never;

/**
 * Text safety for strings. `line` refuses C0/C1 controls (tab and newlines
 * included), U+2028/U+2029 and the bidi overrides and isolates
 * (U+202A–U+202E, U+2066–U+2069); `multiline` allows tab, LF and CR.
 */
export type TextMode = 'line' | 'multiline';

export interface StringSchema extends Schema<string> {
  readonly kind: 'string';
  /** Minimum length in Unicode code points (after trimming). */
  readonly min?: number;
  /** Maximum length in Unicode code points (after trimming). */
  readonly max?: number;
  /** An ECMAScript pattern source, compiled with the `u` flag. Anchor it yourself. */
  readonly pattern?: string;
  /** Values refused even when they match (`reserved`), e.g. `free` for catalog layout ids. */
  readonly not?: readonly string[];
  /** Trim on input and return the trimmed value (reported as a normalization). */
  readonly trim?: boolean;
  readonly text?: TextMode;
}

export interface NumberSchema extends Schema<number> {
  readonly kind: 'number';
  readonly int: boolean;
  readonly min?: number;
  readonly max?: number;
  /** Refuse ±Infinity (default true). NaN is always refused. */
  readonly finite: boolean;
}

export interface BooleanSchema extends Schema<boolean> {
  readonly kind: 'boolean';
}

export interface NullSchema extends Schema<null> {
  readonly kind: 'null';
}

export type LiteralValue = string | number | boolean | null;

export interface LiteralSchema<V extends LiteralValue = LiteralValue> extends Schema<V> {
  readonly kind: 'literal';
  readonly value: V;
  /** The code a mismatch reports (default `enum`), e.g. `unsupported-version`. */
  readonly code?: string;
}

export interface EnumSchema<V extends string = string> extends Schema<V> {
  readonly kind: 'enum';
  readonly values: readonly V[];
  /** The code a mismatch reports (default `enum`). */
  readonly code?: string;
}

export interface ArraySchema<I extends Schema = Schema> extends Schema<Infer<I>[]> {
  readonly kind: 'array';
  readonly item: I;
  readonly min?: number;
  /** Items past `max` are reported once (`too-many`) and not validated. */
  readonly max?: number;
}

export type Shape = { readonly [key: string]: Schema };

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type OptionalKeys<S extends Shape> = {
  [K in keyof S]: S[K] extends OptionalSchema<Schema, false> ? K : never;
}[keyof S];

/** Object output: optional fields without a default become optional keys. */
export type InferShape<S extends Shape> = Simplify<
  { -readonly [K in Exclude<keyof S, OptionalKeys<S>>]: Infer<S[K]> } & {
    -readonly [K in OptionalKeys<S>]?: Exclude<Infer<S[K]>, undefined>;
  }
>;

export interface ObjectSchema<S extends Shape = Shape> extends Schema<InferShape<S>> {
  readonly kind: 'object';
  readonly shape: S;
  /** `true` (default): unknown keys are `unknown-key` issues; `false`: dropped. */
  readonly strict: boolean;
}

export interface RecordSchema<V extends Schema = Schema> extends Schema<Record<string, Infer<V>>> {
  readonly kind: 'record';
  /** Validates each key (pattern, length); keys are never transformed. */
  readonly key?: StringSchema;
  readonly value: V;
  readonly min?: number;
  /** Entries past `max` are reported once (`too-many`) and not validated. */
  readonly max?: number;
}

export interface UnionSchema<O extends readonly Schema[] = readonly Schema[]>
  extends Schema<Infer<O[number]>> {
  readonly kind: 'union';
  readonly options: O;
  /** Every option is an object whose field of this name is a literal, an enum or a string. */
  readonly discriminator?: string;
  /** The code an unknown discriminator reports (default `unknown-kind`). */
  readonly code?: string;
}

export interface NullableSchema<I extends Schema = Schema> extends Schema<Infer<I> | null> {
  readonly kind: 'nullable';
  readonly inner: I;
}

export interface OptionalSchema<I extends Schema = Schema, D extends boolean = boolean>
  extends Schema<D extends true ? Infer<I> : Infer<I> | undefined> {
  readonly kind: 'optional';
  readonly inner: I;
  readonly hasDefault: D;
  /** Applied (as a fresh copy) when the key is missing or `undefined`. */
  readonly default?: Infer<I>;
}

export interface LazySchema<T = unknown> extends Schema<T> {
  readonly kind: 'lazy';
  get(): Schema<T>;
  /** The `$defs` name in the JSON Schema export. */
  readonly name?: string;
  /** How many times this lazy schema may nest along one path (default: the validate depth). */
  readonly maxDepth?: number;
}

export interface RefineIssue {
  code?: string;
  message: string;
  /** Relative to the refined value. */
  path?: readonly PathSegment[];
  fix?: string;
  severity?: DiagnosticSeverity;
}

export interface RefineContext {
  /** The refined value's absolute path. */
  readonly path: readonly PathSegment[];
  issue(issue: RefineIssue): void;
}

export interface RefineSchema<I extends Schema = Schema> extends Schema<Infer<I>> {
  readonly kind: 'refine';
  readonly inner: I;
  /** The default code of the issues this check raises. */
  readonly code: string;
  /** Runs only when the inner schema produced no error. */
  check(value: Infer<I>, context: RefineContext): void;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface JsonValueSchema extends Schema<JsonValue> {
  readonly kind: 'json';
  /** Nested containers allowed: `1` is `{a: 1}`, `2` is `{a: {b: 1}}`. */
  readonly depth: number;
  readonly maxKeys: number;
  readonly maxItems: number;
  /** Code points per string value. */
  readonly maxString: number;
  readonly maxKeyLength: number;
  readonly text?: TextMode;
}

/** The closed set of node shapes the interpreters understand. */
export type SchemaNode =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | NullSchema
  | LiteralSchema
  | EnumSchema
  | ArraySchema
  | ObjectSchema
  | RecordSchema
  | UnionSchema
  | NullableSchema
  | OptionalSchema
  | LazySchema
  | RefineSchema
  | JsonValueSchema;
