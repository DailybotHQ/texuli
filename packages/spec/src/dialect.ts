/**
 * The pinned, closed schema dialect: a small subset of JSON Schema 2020-12
 * that both the TypeScript and Kotlin generators can project exactly. A
 * schema that uses anything else fails `checkSchemaDocument`, and code
 * generation refuses it (spec/Compose design §2.3: unsupported constructs
 * fail generation). Schemas are read as data; nothing is evaluated.
 */

export const DIALECT_URI = 'https://json-schema.org/draft/2020-12/schema';

/** Every keyword the dialect understands. */
export const DIALECT_KEYWORDS = [
  '$schema',
  '$id',
  '$comment',
  '$defs',
  '$ref',
  'title',
  'description',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'minItems',
  'maxItems',
] as const;

export const DIALECT_TYPES = ['object', 'array', 'string', 'number', 'integer', 'boolean'] as const;
export type DialectType = (typeof DIALECT_TYPES)[number];

/** A schema node in the dialect. `{}` (no keywords) accepts any JSON value. */
export interface Schema {
  $schema?: string;
  $id?: string;
  $comment?: string;
  $defs?: Readonly<Record<string, Schema>>;
  $ref?: string;
  title?: string;
  description?: string;
  type?: DialectType;
  properties?: Readonly<Record<string, Schema>>;
  required?: readonly string[];
  /** `false` for a closed object, or a schema for map values. */
  additionalProperties?: false | Schema;
  items?: Schema;
  enum?: readonly (string | number | boolean)[];
  const?: string | number | boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

export interface SchemaIssue {
  code: string;
  path: string;
  message: string;
}

const REF = /^#\/\$defs\/([A-Za-z][A-Za-z0-9]*)$/;
const MAX_DEPTH = 64;

/** The `$defs` name a `$ref` points at. */
export function refName(ref: string): string | undefined {
  return REF.exec(ref)?.[1];
}

/**
 * Check that a schema document stays inside the dialect: known keywords only,
 * local `$ref`s that resolve, a single `type`, and every object either closed
 * (`additionalProperties: false`) or an explicit map. Fails closed.
 */
export function checkSchemaDocument(document: unknown): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (!isRecord(document)) {
    return [{ code: 'not-a-schema', path: '$', message: 'A schema must be an object.' }];
  }
  if (document.$schema !== DIALECT_URI) {
    issues.push({
      code: 'dialect',
      path: '$.$schema',
      message: `"$schema" must be ${DIALECT_URI}.`,
    });
  }
  const defs = isRecord(document.$defs) ? document.$defs : {};
  const visit = (node: unknown, path: string, depth: number): void => {
    if (depth > MAX_DEPTH) {
      issues.push({ code: 'too-deep', path, message: 'The schema nests too deeply.' });
      return;
    }
    if (!isRecord(node)) {
      issues.push({ code: 'not-a-schema', path, message: 'A schema node must be an object.' });
      return;
    }
    for (const key of Object.keys(node)) {
      if (!(DIALECT_KEYWORDS as readonly string[]).includes(key)) {
        issues.push({
          code: 'unsupported-keyword',
          path: `${path}.${key}`,
          message: `"${key}" is not in the dialect.`,
        });
      }
    }
    if (node.$ref !== undefined) {
      const name = typeof node.$ref === 'string' ? refName(node.$ref) : undefined;
      if (name === undefined || !Object.hasOwn(defs, name)) {
        issues.push({
          code: 'bad-ref',
          path: `${path}.$ref`,
          message: 'A $ref must name a local $defs entry.',
        });
      }
    }
    if (node.type !== undefined && !(DIALECT_TYPES as readonly unknown[]).includes(node.type)) {
      issues.push({
        code: 'bad-type',
        path: `${path}.type`,
        message: '"type" must be one dialect type.',
      });
    }
    if (node.type === 'object') {
      if (node.additionalProperties === undefined || node.additionalProperties === true) {
        issues.push({
          code: 'open-object',
          path,
          message: 'Objects must set "additionalProperties": false or a map schema.',
        });
      }
      if (Array.isArray(node.required) && isRecord(node.properties)) {
        for (const name of node.required) {
          if (typeof name !== 'string' || !Object.hasOwn(node.properties, name)) {
            issues.push({
              code: 'bad-required',
              path: `${path}.required`,
              message: `Required "${String(name)}" is not a declared property.`,
            });
          }
        }
      }
    }
    if (node.enum !== undefined) {
      const values = node.enum;
      const valid =
        Array.isArray(values) &&
        values.length > 0 &&
        values.every(
          (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
        );
      if (!valid) {
        issues.push({
          code: 'bad-enum',
          path: `${path}.enum`,
          message: '"enum" must list scalars.',
        });
      }
    }
    if (isRecord(node.properties)) {
      for (const [name, child] of Object.entries(node.properties)) {
        visit(child, `${path}.properties.${name}`, depth + 1);
      }
    }
    if (isRecord(node.additionalProperties)) {
      visit(node.additionalProperties, `${path}.additionalProperties`, depth + 1);
    }
    if (node.items !== undefined) visit(node.items, `${path}.items`, depth + 1);
    if (isRecord(node.$defs)) {
      for (const [name, child] of Object.entries(node.$defs)) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
          issues.push({
            code: 'bad-def-name',
            path: `${path}.$defs.${name}`,
            message: 'Def names are alphanumeric.',
          });
        }
        visit(child, `${path}.$defs.${name}`, depth + 1);
      }
    }
  };
  visit(document, '$', 0);
  return issues;
}

/**
 * Validate a JSON value against a dialect schema. `root` resolves `$ref`s
 * (defaults to `schema`). Returns every issue, with JSON paths from `$`.
 */
export function validateInstance(
  schema: Schema,
  value: unknown,
  root: Schema = schema
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  const fail = (code: string, path: string, message: string): void => {
    issues.push({ code, path, message });
  };
  const visit = (node: Schema, current: unknown, path: string, depth: number): void => {
    if (depth > MAX_DEPTH) {
      fail('too-deep', path, 'The value nests too deeply.');
      return;
    }
    if (node.$ref !== undefined) {
      const name = refName(node.$ref);
      const target = name === undefined ? undefined : root.$defs?.[name];
      if (target === undefined) fail('bad-ref', path, `Unresolved ${node.$ref}.`);
      else visit(target, current, path, depth + 1);
      return;
    }
    if (node.const !== undefined && current !== node.const) {
      fail('const', path, `Must be ${JSON.stringify(node.const)}.`);
      return;
    }
    if (node.enum !== undefined && !node.enum.includes(current as string)) {
      fail('enum', path, `Must be one of ${node.enum.map((v) => JSON.stringify(v)).join(', ')}.`);
      return;
    }
    switch (node.type) {
      case undefined:
        return;
      case 'string':
        if (typeof current !== 'string') {
          fail('type', path, 'Must be a string.');
          return;
        }
        if (node.minLength !== undefined && [...current].length < node.minLength)
          fail('min-length', path, `At least ${node.minLength} characters.`);
        if (node.maxLength !== undefined && [...current].length > node.maxLength)
          fail('max-length', path, `At most ${node.maxLength} characters.`);
        if (node.pattern !== undefined && !new RegExp(node.pattern, 'u').test(current))
          fail('pattern', path, `Must match ${node.pattern}.`);
        return;
      case 'number':
      case 'integer':
        if (typeof current !== 'number' || !Number.isFinite(current)) {
          fail('type', path, 'Must be a finite number.');
          return;
        }
        if (node.type === 'integer' && !Number.isInteger(current)) {
          fail('type', path, 'Must be an integer.');
          return;
        }
        if (node.minimum !== undefined && current < node.minimum)
          fail('minimum', path, `At least ${node.minimum}.`);
        if (node.maximum !== undefined && current > node.maximum)
          fail('maximum', path, `At most ${node.maximum}.`);
        return;
      case 'boolean':
        if (typeof current !== 'boolean') fail('type', path, 'Must be a boolean.');
        return;
      case 'array':
        if (!Array.isArray(current)) {
          fail('type', path, 'Must be an array.');
          return;
        }
        if (node.minItems !== undefined && current.length < node.minItems)
          fail('min-items', path, `At least ${node.minItems} items.`);
        if (node.maxItems !== undefined && current.length > node.maxItems) {
          fail('max-items', path, `At most ${node.maxItems} items.`);
          return;
        }
        if (node.items) {
          const items = node.items;
          current.forEach((item, index) => {
            visit(items, item, `${path}[${index}]`, depth + 1);
          });
        }
        return;
      case 'object': {
        if (!isRecord(current)) {
          fail('type', path, 'Must be an object.');
          return;
        }
        const properties = node.properties ?? {};
        for (const name of node.required ?? []) {
          if (!Object.hasOwn(current, name))
            fail('required', `${path}.${name}`, `"${name}" is required.`);
        }
        for (const [key, child] of Object.entries(current)) {
          const here = `${path}.${key}`;
          const declared = Object.hasOwn(properties, key) ? properties[key] : undefined;
          if (declared) visit(declared, child, here, depth + 1);
          else if (node.additionalProperties)
            visit(node.additionalProperties, child, here, depth + 1);
          else fail('additional-property', here, `"${key}" is not allowed.`);
        }
        return;
      }
    }
  };
  visit(schema, value, '$', 0);
  return issues;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
