/**
 * Helpers shared by the builders, the validator and the JSON Schema emitter.
 * Derived lookups (compiled patterns, discriminator maps) live in caches here
 * so the schema nodes themselves stay plain frozen data.
 */
import type {
  LiteralValue,
  ObjectSchema,
  Schema,
  SchemaNode,
  TextMode,
  UnionSchema,
} from './types.ts';

/** Keys never accepted as data, in any object or record (prototype pollution). */
export const UNSAFE_KEYS: readonly string[] = Object.freeze([
  '__proto__',
  'constructor',
  'prototype',
]);
const UNSAFE = new Set(UNSAFE_KEYS);

export function isUnsafeKey(key: string): boolean {
  return UNSAFE.has(key);
}

/** Length in Unicode code points (a surrogate pair counts once, a lone surrogate once). */
export function codePointLength(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    count++;
  }
  return count;
}

/**
 * True when `value` has more than `max` code points. Strings longer than
 * `2 × max` UTF-16 units are refused without counting.
 */
export function exceedsCodePoints(value: string, max: number): boolean {
  if (value.length <= max) return false;
  if (value.length > max * 2) return true;
  return codePointLength(value) > max;
}

/** Index of the first character `mode` refuses, or `-1`. */
export function unsafeTextIndex(value: string, mode: TextMode): number {
  const multiline = mode === 'multiline';
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20) {
      if (multiline && (c === 0x09 || c === 0x0a || c === 0x0d)) continue;
      return i;
    }
    if (c < 0x7f) continue;
    if (c <= 0x9f) return i;
    if (c < 0x2028) continue;
    if (c <= 0x2029) {
      if (multiline) continue;
      return i;
    }
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) return i;
  }
  return -1;
}

/** The same rule as `unsafeTextIndex`, as a JSON Schema pattern source. */
export function textPattern(mode: TextMode): string {
  return mode === 'multiline'
    ? '^[^\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u202A-\\u202E\\u2066-\\u2069]*$'
    : '^[^\\u0000-\\u001F\\u007F-\\u009F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069]*$';
}

export function describeChar(value: string, index: number): string {
  const code = value.codePointAt(index) ?? 0;
  return `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
}

const patterns = new Map<string, RegExp>();

/** Patterns compile once, with the `u` flag (no `g`/`y`, so `test` is stateless). */
export function compilePattern(source: string): RegExp {
  let compiled = patterns.get(source);
  if (!compiled) {
    compiled = new RegExp(source, 'u');
    patterns.set(source, compiled);
  }
  return compiled;
}

/** Follow refine wrappers down to an object schema, if there is one. */
export function unwrapObject(schema: Schema): ObjectSchema | undefined {
  let node = schema as SchemaNode;
  for (let guard = 0; guard < 64; guard++) {
    if (node.kind === 'object') return node;
    if (node.kind === 'refine') node = node.inner as SchemaNode;
    else return undefined;
  }
  return undefined;
}

export interface DiscriminatorIndex {
  /** Discriminator value → option index. */
  readonly map: ReadonlyMap<LiteralValue, number>;
  /** Options whose discriminator is a plain string schema, tried in order. */
  readonly fallbacks: readonly number[];
  /** Every mapped value, in declaration order. */
  readonly values: readonly LiteralValue[];
}

const discriminators = new WeakMap<UnionSchema, DiscriminatorIndex>();

/** Build (once) the lookup of a discriminated union; throws on a malformed union. */
export function discriminatorIndex(union: UnionSchema): DiscriminatorIndex {
  const cached = discriminators.get(union);
  if (cached) return cached;
  const key = union.discriminator;
  if (key === undefined) throw new TypeError('The union has no discriminator.');
  const map = new Map<LiteralValue, number>();
  const fallbacks: number[] = [];
  const values: LiteralValue[] = [];
  union.options.forEach((option, index) => {
    const object = unwrapObject(option);
    const field = object?.shape[key] as SchemaNode | undefined;
    if (!field) {
      throw new TypeError(`Union option ${index} is not an object with a "${key}" field.`);
    }
    const add = (value: LiteralValue): void => {
      if (map.has(value)) {
        throw new TypeError(`Union options share the "${key}" value ${JSON.stringify(value)}.`);
      }
      map.set(value, index);
      values.push(value);
    };
    if (field.kind === 'literal') add(field.value);
    else if (field.kind === 'enum') for (const value of field.values) add(value);
    else if (field.kind === 'string') fallbacks.push(index);
    else {
      throw new TypeError(
        `Union option ${index}: "${key}" must be a literal, an enum or a string schema.`
      );
    }
  });
  const index: DiscriminatorIndex = Object.freeze({ map, fallbacks, values });
  discriminators.set(union, index);
  return index;
}

export type JsonType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';
const ALL_TYPES: ReadonlySet<JsonType> = new Set([
  'string',
  'number',
  'boolean',
  'null',
  'array',
  'object',
]);

const accepted = new WeakMap<Schema, ReadonlySet<JsonType>>();

/** The JSON types a schema can accept, used to pick the relevant union option. */
export function acceptedTypes(schema: Schema): ReadonlySet<JsonType> {
  const cached = accepted.get(schema);
  if (cached) return cached;
  const node = schema as SchemaNode;
  let types: ReadonlySet<JsonType>;
  switch (node.kind) {
    case 'string':
    case 'enum':
      types = new Set(['string']);
      break;
    case 'number':
      types = new Set(['number']);
      break;
    case 'boolean':
      types = new Set(['boolean']);
      break;
    case 'null':
      types = new Set(['null']);
      break;
    case 'literal':
      types = new Set([node.value === null ? 'null' : (typeof node.value as JsonType)]);
      break;
    case 'array':
      types = new Set(['array']);
      break;
    case 'object':
    case 'record':
      types = new Set(['object']);
      break;
    case 'union': {
      const all = new Set<JsonType>();
      for (const option of node.options) for (const type of acceptedTypes(option)) all.add(type);
      types = all;
      break;
    }
    case 'nullable':
      types = new Set([...acceptedTypes(node.inner), 'null']);
      break;
    case 'optional':
    case 'refine':
      types = acceptedTypes(node.inner);
      break;
    default:
      // lazy (resolving it here could recurse forever) and json accept anything.
      types = ALL_TYPES;
  }
  accepted.set(schema, types);
  return types;
}

/** The JSON type name of a value, or a JS name (`undefined`, `function`…) for non-JSON. */
export function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return typeof value;
  try {
    return Array.isArray(value) ? 'array' : 'object';
  } catch {
    return 'object';
  }
}
