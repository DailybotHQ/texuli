/**
 * The owned JSON Schema validator for the operations registry: the subset of
 * JSON Schema 2020-12 the operations use, and nothing else. A schema with a
 * keyword outside the subset is refused when the registry is built
 * (`schemaKeywordIssues`), so no constraint is ever silently ignored.
 *
 * Supported: `type` (one name or a list), `enum`, `const`, `properties`,
 * `required`, `additionalProperties` (boolean or schema), `items`,
 * `minItems`, `maxItems`, `minLength`, `maxLength` (code points), `pattern`
 * (Unicode), `minimum`, `maximum`, plus the annotations `title`,
 * `description`, `default`, `examples` and `$comment`.
 */

export type JsonSchemaType =
  | 'object'
  | 'array'
  | 'string'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'null';

export interface JsonSchema {
  type?: JsonSchemaType | readonly JsonSchemaType[];
  enum?: readonly unknown[];
  const?: unknown;
  properties?: Readonly<Record<string, JsonSchema>>;
  required?: readonly string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  title?: string;
  description?: string;
  default?: unknown;
  examples?: readonly unknown[];
  $comment?: string;
  /** Any other keyword is refused by `schemaKeywordIssues`. */
  [keyword: string]: unknown;
}

/** One validation failure: a JSONPath-style location and a sentence. */
export interface SchemaIssue {
  path: string;
  message: string;
}

/** Every keyword the validator understands. */
export const SUPPORTED_SCHEMA_KEYWORDS: readonly string[] = Object.freeze([
  'type',
  'enum',
  'const',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'title',
  'description',
  'default',
  'examples',
  '$comment',
]);

const MAX_ISSUES = 20;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Keywords a schema (and its subschemas) uses that the validator does not support. */
export function schemaKeywordIssues(schema: JsonSchema, path = '#'): string[] {
  const issues: string[] = [];
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.includes(key))
      issues.push(`${path}: unsupported keyword "${key}"`);
  }
  for (const [name, sub] of Object.entries(schema.properties ?? {}))
    issues.push(...schemaKeywordIssues(sub, `${path}/properties/${name}`));
  if (isPlainObject(schema.additionalProperties))
    issues.push(
      ...schemaKeywordIssues(
        schema.additionalProperties as JsonSchema,
        `${path}/additionalProperties`
      )
    );
  if (schema.items) issues.push(...schemaKeywordIssues(schema.items, `${path}/items`));
  return issues;
}

function typeOf(value: unknown): JsonSchemaType | 'undefined' | 'other' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'other';
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  if (typeof value === 'object') return 'object';
  return value === undefined ? 'undefined' : 'other';
}

function matchesType(value: unknown, type: JsonSchemaType): boolean {
  const actual = typeOf(value);
  if (type === 'number') return actual === 'number' || actual === 'integer';
  return actual === type;
}

/** Deep equality for JSON values (enum and const). */
function jsonEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length && left.every((item, index) => jsonEqual(item, right[index]))
    );
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every((key) => Object.hasOwn(right, key) && jsonEqual(left[key], right[key]))
    );
  }
  return false;
}

function codePoints(text: string): number {
  let count = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index++;
    }
    count++;
  }
  return count;
}

const describe = (value: unknown) =>
  typeof value === 'string' ? JSON.stringify(value) : String(JSON.stringify(value) ?? value);

function check(schema: JsonSchema, value: unknown, path: string, issues: SchemaIssue[]): void {
  if (issues.length >= MAX_ISSUES) return;
  const push = (message: string) => {
    if (issues.length < MAX_ISSUES) issues.push({ path, message: `${path} ${message}` });
  };
  if (schema.type !== undefined) {
    const types = (
      typeof schema.type === 'string' ? [schema.type] : schema.type
    ) as readonly JsonSchemaType[];
    if (!types.some((type) => matchesType(value, type))) {
      const names = types.map((type) =>
        type === 'object' || type === 'array' || type === 'integer' ? `an ${type}` : `a ${type}`
      );
      push(`must be ${names.join(' or ')}.`);
      return;
    }
  }
  if (schema.const !== undefined && !jsonEqual(value, schema.const))
    push(`must be ${describe(schema.const)}.`);
  if (schema.enum && !schema.enum.some((option) => jsonEqual(value, option)))
    push(`must be one of ${schema.enum.map(describe).join(', ')}.`);

  if (typeof value === 'string') {
    const length =
      schema.minLength !== undefined || schema.maxLength !== undefined ? codePoints(value) : 0;
    if (schema.minLength !== undefined && length < schema.minLength)
      push(`must have at least ${schema.minLength} character${schema.minLength === 1 ? '' : 's'}.`);
    if (schema.maxLength !== undefined && length > schema.maxLength)
      push(`must have at most ${schema.maxLength} characters.`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value))
      push(`must match the pattern ${schema.pattern}.`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      push(`must be at least ${schema.minimum}.`);
    if (schema.maximum !== undefined && value > schema.maximum)
      push(`must be at most ${schema.maximum}.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      push(`must have at least ${schema.minItems} items.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      push(`must have at most ${schema.maxItems} items.`);
    else if (schema.items) {
      const items = schema.items;
      value.forEach((item, index) => {
        check(items, item, `${path}[${index}]`, issues);
      });
    }
  }
  if (isPlainObject(value)) {
    for (const name of schema.required ?? []) {
      if (!Object.hasOwn(value, name)) {
        if (issues.length < MAX_ISSUES)
          issues.push({ path: `${path}.${name}`, message: `${path}.${name} is required.` });
      }
    }
    const properties = schema.properties ?? {};
    for (const key of Object.keys(value)) {
      const child = `${path}.${key}`;
      if (Object.hasOwn(properties, key)) {
        check(properties[key] as JsonSchema, value[key], child, issues);
      } else if (schema.additionalProperties === false) {
        if (issues.length < MAX_ISSUES)
          issues.push({
            path: child,
            message: `${child} is not an accepted argument${
              Object.keys(properties).length > 0
                ? ` (accepted: ${Object.keys(properties).join(', ')})`
                : ''
            }.`,
          });
      } else if (isPlainObject(schema.additionalProperties)) {
        check(schema.additionalProperties as JsonSchema, value[key], child, issues);
      }
    }
  }
}

/**
 * Validate a JSON value against a schema in the supported subset. Returns
 * the issues (at most 20), or an empty list when the value is valid.
 */
export function validateJson(schema: JsonSchema, value: unknown, path = '$'): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  check(schema, value, path, issues);
  return issues;
}
