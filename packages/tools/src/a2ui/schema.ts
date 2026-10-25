import { A2UI_VERSION, type A2uiDiagnostic } from './types.ts';

/** A JSON Schema document (the subset of keywords {@link checkJsonSchema} reads). */
export type JsonSchema = { readonly [keyword: string]: unknown };

const KEBAB_ID = '^[a-z][a-z0-9]*(-[a-z0-9]+)*$';
const ref = (name: string) => ({ $ref: `#/$defs/${name}` });
const message = (key: string, body: JsonSchema): JsonSchema => ({
  type: 'object',
  required: ['version', key],
  additionalProperties: false,
  properties: { version: { const: A2UI_VERSION }, [key]: body },
});

/**
 * The A2UI v0.9 server-to-client message schema, as Texuli checks it.
 *
 * A hand-written subset of the upstream `server_to_client.json` and
 * `common_types.json` (`https://a2ui.org/specification/v0_9/`): the same four
 * messages, required fields, `additionalProperties: false` and `ChildList`.
 * Upstream leaves the component shape to the catalog; here a component is
 * `id` plus a Texuli catalog id in `component`, with props beside them.
 */
export const A2UI_MESSAGE_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'texuli:a2ui/v0.9/server-to-client',
  title: 'A2UI v0.9 server-to-client message (Texuli catalog)',
  oneOf: [
    ref('CreateSurfaceMessage'),
    ref('UpdateComponentsMessage'),
    ref('UpdateDataModelMessage'),
    ref('DeleteSurfaceMessage'),
  ],
  $defs: {
    CreateSurfaceMessage: message('createSurface', {
      type: 'object',
      required: ['surfaceId', 'catalogId'],
      additionalProperties: false,
      properties: {
        surfaceId: ref('SurfaceId'),
        catalogId: { type: 'string', minLength: 1 },
        theme: { type: 'object' },
        sendDataModel: { type: 'boolean' },
      },
    }),
    UpdateComponentsMessage: message('updateComponents', {
      type: 'object',
      required: ['surfaceId', 'components'],
      additionalProperties: false,
      properties: {
        surfaceId: ref('SurfaceId'),
        components: { type: 'array', minItems: 1, items: ref('AnyComponent') },
      },
    }),
    UpdateDataModelMessage: message('updateDataModel', {
      type: 'object',
      required: ['surfaceId'],
      additionalProperties: false,
      properties: { surfaceId: ref('SurfaceId'), path: { type: 'string' }, value: {} },
    }),
    DeleteSurfaceMessage: message('deleteSurface', {
      type: 'object',
      required: ['surfaceId'],
      additionalProperties: false,
      properties: { surfaceId: ref('SurfaceId') },
    }),
    SurfaceId: { type: 'string', minLength: 1 },
    ComponentId: { type: 'string', minLength: 1 },
    ChildList: {
      oneOf: [
        { type: 'array', items: ref('ComponentId') },
        {
          type: 'object',
          required: ['componentId', 'path'],
          additionalProperties: false,
          properties: { componentId: ref('ComponentId'), path: { type: 'string' } },
        },
      ],
    },
    AnyComponent: {
      type: 'object',
      required: ['id', 'component'],
      properties: {
        id: ref('ComponentId'),
        component: { type: 'string', pattern: KEBAB_ID },
        children: ref('ChildList'),
        child: ref('ComponentId'),
      },
    },
  },
};

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function typeMatches(actual: string, expected: unknown): boolean {
  const list = Array.isArray(expected) ? expected : [expected];
  return list.some((t) => t === actual || (t === 'number' && actual === 'integer'));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const own = (record: Record<string, unknown>, key: string) => Object.hasOwn(record, key);

/**
 * Validate `value` against `schema`, resolving `#/$defs/*` refs in `root`.
 *
 * Reads only the keywords Texuli's schemas use: `$ref`, `type`, `const`,
 * `enum`, `required`, `properties`, `additionalProperties`, `items`,
 * `minItems`, `minLength`, `pattern`, `oneOf` and `anyOf`. Any other keyword
 * is ignored, so this is not a general JSON Schema validator.
 */
export function checkJsonSchema(
  schema: JsonSchema,
  value: unknown,
  path = '$',
  root: JsonSchema = schema
): A2uiDiagnostic[] {
  const errors: A2uiDiagnostic[] = [];
  const fail = (at: string, text: string) =>
    errors.push({ code: 'schema', path: at, message: text });

  if (typeof schema.$ref === 'string') {
    const name = schema.$ref.replace(/^#\/\$defs\//, '');
    const defs = root.$defs;
    const target = isRecord(defs) && own(defs, name) ? defs[name] : undefined;
    if (!isRecord(target))
      return [{ code: 'schema', path, message: `Unknown $ref ${schema.$ref}` }];
    return checkJsonSchema(target, value, path, root);
  }
  if (schema.type !== undefined && !typeMatches(typeOf(value), schema.type)) {
    fail(path, `Expected ${String(schema.type)}, got ${typeOf(value)}.`);
    return errors;
  }
  if (own(schema, 'const') && value !== schema.const) {
    fail(path, `Expected ${JSON.stringify(schema.const)}.`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    fail(path, `Expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}.`);
  }
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      fail(path, `Expected at least ${schema.minLength} characters.`);
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
      fail(path, `Does not match ${schema.pattern}.`);
    }
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      fail(path, `Expected at least ${schema.minItems} items.`);
    }
    if (isRecord(schema.items)) {
      const items = schema.items;
      value.forEach((item, i) => {
        errors.push(...checkJsonSchema(items, item, `${path}[${i}]`, root));
      });
    }
  }
  if (isRecord(value)) {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof key === 'string' && !own(value, key)) fail(path, `Missing required "${key}".`);
      }
    }
    for (const key of Object.keys(value)) {
      const at = `${path}.${key}`;
      const sub = own(properties, key) ? properties[key] : undefined;
      if (isRecord(sub)) errors.push(...checkJsonSchema(sub, value[key], at, root));
      else if (schema.additionalProperties === false) fail(at, `Unexpected property "${key}".`);
      else if (isRecord(schema.additionalProperties)) {
        errors.push(...checkJsonSchema(schema.additionalProperties, value[key], at, root));
      }
    }
  }
  for (const keyword of ['oneOf', 'anyOf'] as const) {
    const branches = schema[keyword];
    if (!Array.isArray(branches)) continue;
    const results = branches.map((b) => (isRecord(b) ? checkJsonSchema(b, value, path, root) : []));
    const passing = results.filter((r) => r.length === 0).length;
    if (keyword === 'anyOf' ? passing === 0 : passing !== 1) {
      // Report the closest branch so the message names the real problem.
      const closest = results.reduce((best, r) => (r.length < best.length ? r : best));
      if (passing > 1) fail(path, 'Matches more than one oneOf branch.');
      else errors.push(...closest);
    }
  }
  return errors;
}

/** Validate a list of A2UI messages against {@link A2UI_MESSAGE_SCHEMA}. */
export function validateA2uiMessages(messages: unknown): A2uiDiagnostic[] {
  if (!Array.isArray(messages)) {
    return [{ code: 'schema', path: '$', message: 'Expected an array of A2UI messages.' }];
  }
  return messages.flatMap((m, i) => checkJsonSchema(A2UI_MESSAGE_SCHEMA, m, `$[${i}]`));
}
