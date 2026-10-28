/**
 * The combinators. Each returns a frozen plain object describing a shape;
 * `validate` and `toJsonSchema` interpret it, and `Infer` reads its type.
 * Builders throw `TypeError` on a malformed schema (a developer error, at
 * module load); validation itself never throws.
 */
import {
  compilePattern,
  discriminatorIndex,
  isUnsafeKey,
  UNSAFE_KEYS,
  unwrapObject,
} from './internal.ts';
import type {
  ArraySchema,
  BooleanSchema,
  EnumSchema,
  Infer,
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
  RefineSchema,
  Schema,
  Shape,
  StringSchema,
  TextMode,
  UnionSchema,
} from './types.ts';
import { validate } from './validate.ts';

export interface Described {
  description?: string;
}

function freeze<T extends object>(node: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) if (value !== undefined) out[key] = value;
  return Object.freeze(out) as T;
}

function count(name: string, value: number | undefined): void {
  if (value !== undefined && !(Number.isInteger(value) && value >= 0)) {
    throw new TypeError(`${name} must be a whole number, got ${value}.`);
  }
}

function bounds(min: number | undefined, max: number | undefined): void {
  count('min', min);
  count('max', max);
  if (min !== undefined && max !== undefined && min > max) {
    throw new TypeError(`min (${min}) is greater than max (${max}).`);
  }
}

export interface StringOptions extends Described {
  /** Code points, counted after trimming. */
  min?: number;
  /** Code points, counted after trimming. */
  max?: number;
  pattern?: RegExp | string;
  not?: readonly string[];
  trim?: boolean;
  text?: TextMode;
}

function string(options: StringOptions = {}): StringSchema {
  bounds(options.min, options.max);
  let pattern: string | undefined;
  if (options.pattern !== undefined) {
    if (typeof options.pattern === 'string') pattern = options.pattern;
    else {
      if (/[^uv]/.test(options.pattern.flags)) {
        throw new TypeError(
          'Patterns take no flags (they compile with "u" and must port to JSON Schema).'
        );
      }
      pattern = options.pattern.source;
    }
    compilePattern(pattern);
  }
  return freeze({
    kind: 'string',
    min: options.min,
    max: options.max,
    pattern,
    not: options.not ? Object.freeze([...options.not]) : undefined,
    trim: options.trim || undefined,
    text: options.text,
    description: options.description,
  }) as StringSchema;
}

export interface NumberOptions extends Described {
  min?: number;
  max?: number;
  /** Refuse ±Infinity (default true). */
  finite?: boolean;
}

function numeric(int: boolean, options: NumberOptions): NumberSchema {
  if (options.min !== undefined && options.max !== undefined && options.min > options.max) {
    throw new TypeError(`min (${options.min}) is greater than max (${options.max}).`);
  }
  return freeze({
    kind: 'number',
    int,
    min: options.min,
    max: options.max,
    finite: options.finite ?? true,
    description: options.description,
  }) as NumberSchema;
}

function number(options: NumberOptions = {}): NumberSchema {
  return numeric(false, options);
}

function int(options: NumberOptions = {}): NumberSchema {
  return numeric(true, options);
}

function boolean(options: Described = {}): BooleanSchema {
  return freeze({ kind: 'boolean', description: options.description }) as BooleanSchema;
}

function nullValue(options: Described = {}): NullSchema {
  return freeze({ kind: 'null', description: options.description }) as NullSchema;
}

export interface CodeOptions extends Described {
  /** The code a mismatch reports instead of `enum`. */
  code?: string;
}

function literal<const V extends LiteralValue>(
  value: V,
  options: CodeOptions = {}
): LiteralSchema<V> {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('A literal number must be finite.');
  }
  return freeze({
    kind: 'literal',
    value,
    code: options.code,
    description: options.description,
  }) as LiteralSchema<V>;
}

function enumOf<const V extends readonly [string, ...string[]]>(
  values: V,
  options: CodeOptions = {}
): EnumSchema<V[number]> {
  if (values.length === 0) throw new TypeError('An enum needs at least one value.');
  if (new Set(values).size !== values.length) throw new TypeError('Enum values must be unique.');
  return freeze({
    kind: 'enum',
    values: Object.freeze([...values]),
    code: options.code,
    description: options.description,
  }) as EnumSchema<V[number]>;
}

export interface SizeOptions extends Described {
  min?: number;
  max?: number;
}

function array<I extends Schema>(item: I, options: SizeOptions = {}): ArraySchema<I> {
  bounds(options.min, options.max);
  return freeze({
    kind: 'array',
    item,
    min: options.min,
    max: options.max,
    description: options.description,
  }) as ArraySchema<I>;
}

export interface ObjectOptions extends Described {
  /** `true` (default) reports unknown keys; `false` drops them. */
  strict?: boolean;
}

function object<const S extends Shape>(shape: S, options: ObjectOptions = {}): ObjectSchema<S> {
  const copy: Record<string, Schema> = {};
  for (const key of Object.keys(shape)) {
    if (isUnsafeKey(key)) throw new TypeError(`The key "${key}" cannot be declared.`);
    copy[key] = shape[key] as Schema;
  }
  return freeze({
    kind: 'object',
    shape: Object.freeze(copy),
    strict: options.strict ?? true,
    description: options.description,
  }) as unknown as ObjectSchema<S>;
}

export interface RecordOptions extends SizeOptions {
  /** Validates every key; `__proto__`, `constructor` and `prototype` are always refused. */
  key?: StringSchema;
}

function record<V extends Schema>(value: V, options: RecordOptions = {}): RecordSchema<V> {
  bounds(options.min, options.max);
  return freeze({
    kind: 'record',
    key: options.key,
    value,
    min: options.min,
    max: options.max,
    description: options.description,
  }) as RecordSchema<V>;
}

export interface UnionOptions extends Described {
  /** Pick the option by this key's value (one issue when it is unknown). */
  discriminator?: string;
  /** The code an unknown discriminator reports instead of `unknown-kind`. */
  code?: string;
}

function union<const O extends readonly [Schema, ...Schema[]]>(
  options: O,
  settings: UnionOptions = {}
): UnionSchema<O> {
  if (options.length === 0) throw new TypeError('A union needs at least one option.');
  const node = freeze({
    kind: 'union',
    options: Object.freeze([...options]),
    discriminator: settings.discriminator,
    code: settings.code,
    description: settings.description,
  }) as unknown as UnionSchema<O>;
  if (node.discriminator !== undefined) discriminatorIndex(node); // throws when malformed
  return node;
}

function nullable<I extends Schema>(inner: I, options: Described = {}): NullableSchema<I> {
  return freeze({ kind: 'nullable', inner, description: options.description }) as NullableSchema<I>;
}

export interface OptionalOptions<T> extends Described {
  /** Applied as a fresh copy when the key is missing; must be valid for the inner schema. */
  default?: T;
}

function optional<I extends Schema>(
  inner: I,
  options: Described & { default: Infer<I> }
): OptionalSchema<I, true>;
function optional<I extends Schema>(inner: I, options?: Described): OptionalSchema<I, false>;
function optional<I extends Schema>(
  inner: I,
  options: OptionalOptions<Infer<I>> = {}
): OptionalSchema<I, boolean> {
  const hasDefault = Object.hasOwn(options, 'default');
  if (hasDefault) {
    const check = validate(inner, options.default);
    if (!check.ok) {
      throw new TypeError(`The default is not valid: ${check.issues[0]?.message ?? 'invalid'}`);
    }
  }
  return freeze({
    kind: 'optional',
    inner,
    hasDefault,
    default: hasDefault ? deepFreeze(options.default) : undefined,
    description: options.description,
  }) as OptionalSchema<I, boolean>;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export interface LazyOptions extends Described {
  /** The `$defs` name in the JSON Schema export. */
  name?: string;
  /** How many times this schema may nest along one path. */
  maxDepth?: number;
}

/**
 * A recursive schema. TypeScript cannot infer a recursive type from a value,
 * so annotate it: `const Node: Schema<TreeNode> = t.object({ kids: t.array(t.lazy(() => Node)) })`.
 */
function lazy<T>(get: () => Schema<T>, options: LazyOptions = {}): LazySchema<T> {
  count('maxDepth', options.maxDepth);
  if (options.name !== undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(options.name)) {
    throw new TypeError(`Invalid lazy schema name "${options.name}".`);
  }
  return freeze({
    kind: 'lazy',
    get,
    name: options.name,
    maxDepth: options.maxDepth,
    description: options.description,
  }) as LazySchema<T>;
}

export interface RefineOptions<T> extends Described {
  /** The default code of the issues `check` raises (stable kebab-case). */
  code: string;
  /** Raise issues through `context.issue`; runs only when the inner schema passed. */
  check(value: T, context: RefineContext): void;
}

/**
 * A named custom check. The `description` documents the rule and is copied
 * into the JSON Schema `description`, since JSON Schema cannot express it.
 */
function refine<I extends Schema>(inner: I, options: RefineOptions<Infer<I>>): RefineSchema<I> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.code)) {
    throw new TypeError(`Refinement codes are kebab-case, got "${options.code}".`);
  }
  return freeze({
    kind: 'refine',
    inner,
    code: options.code,
    check: options.check,
    description: options.description,
  }) as RefineSchema<I>;
}

export interface JsonOptions extends Described {
  /** Nested containers allowed (default 4). */
  depth?: number;
  /** Keys per object (default 100). */
  maxKeys?: number;
  /** Items per array (default 200). */
  maxItems?: number;
  /** Code points per string (default 2,000). */
  maxString?: number;
  /** Code points per key (default 64). */
  maxKeyLength?: number;
  text?: TextMode;
}

/** Protoyard's props limits (`DECK_LIMITS`): depth 4, 100 keys, 200 items, 2,000-character strings. */
export const JSON_DEFAULTS = Object.freeze({
  depth: 4,
  maxKeys: 100,
  maxItems: 200,
  maxString: 2_000,
  maxKeyLength: 64,
});

/** Bounded JSON data: plain objects, arrays, finite numbers, strings, booleans, null. */
function json(options: JsonOptions = {}): JsonValueSchema {
  const node = {
    kind: 'json',
    depth: options.depth ?? JSON_DEFAULTS.depth,
    maxKeys: options.maxKeys ?? JSON_DEFAULTS.maxKeys,
    maxItems: options.maxItems ?? JSON_DEFAULTS.maxItems,
    maxString: options.maxString ?? JSON_DEFAULTS.maxString,
    maxKeyLength: options.maxKeyLength ?? JSON_DEFAULTS.maxKeyLength,
    text: options.text,
    description: options.description,
  } as const;
  for (const key of ['depth', 'maxKeys', 'maxItems', 'maxString', 'maxKeyLength'] as const) {
    count(key, node[key]);
  }
  return freeze(node) as JsonValueSchema;
}

/** A copy of `schema` with a description (shown in the JSON Schema). */
function describe<S extends Schema>(schema: S, description: string): S {
  return freeze({ ...schema, description }) as S;
}

/** An object schema with more (or replaced) fields; keeps strictness unless overridden. */
function extend<S extends Shape, E extends Shape>(
  base: ObjectSchema<S>,
  shape: E,
  options: ObjectOptions = {}
): ObjectSchema<Omit<S, keyof E> & E> {
  return object({ ...base.shape, ...shape } as Omit<S, keyof E> & E, {
    strict: options.strict ?? base.strict,
    description: options.description ?? base.description,
  }) as ObjectSchema<Omit<S, keyof E> & E>;
}

function pick<S extends Shape, const K extends keyof S & string>(
  base: ObjectSchema<S>,
  keys: readonly K[]
): ObjectSchema<Pick<S, K>> {
  const shape: Record<string, Schema> = {};
  for (const key of keys) shape[key] = base.shape[key] as Schema;
  return object(shape as Pick<S, K>, { strict: base.strict }) as ObjectSchema<Pick<S, K>>;
}

function omit<S extends Shape, const K extends keyof S & string>(
  base: ObjectSchema<S>,
  keys: readonly K[]
): ObjectSchema<Omit<S, K>> {
  const shape: Record<string, Schema> = { ...base.shape };
  for (const key of keys) delete shape[key];
  return object(shape as Omit<S, K>, { strict: base.strict }) as ObjectSchema<Omit<S, K>>;
}

/** The field schema of a discriminated union option, after unwrapping refinements. */
export function objectOf(schema: Schema): ObjectSchema | undefined {
  return unwrapObject(schema);
}

/** The combinators, as one frozen object: `t.object({ title: t.string({ max: 200 }) })`. */
export const t = Object.freeze({
  string,
  number,
  int,
  boolean,
  null: nullValue,
  literal,
  enum: enumOf,
  array,
  object,
  record,
  union,
  nullable,
  optional,
  lazy,
  refine,
  json,
  describe,
  extend,
  pick,
  omit,
});

export { UNSAFE_KEYS };
