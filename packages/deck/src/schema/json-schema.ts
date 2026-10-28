/**
 * JSON Schema 2020-12 from the same schema data the validator walks, so the
 * export never drifts. Lengths are code points on both sides (JSON Schema
 * `minLength`/`maxLength` count code points). Refinements and trimming cannot
 * be expressed, so they are documented in `description`.
 */
import { discriminatorIndex, textPattern, UNSAFE_KEYS } from './internal.ts';
import type { JsonValueSchema, LazySchema, Schema, SchemaNode, StringSchema } from './types.ts';

export type JsonSchema = { [key: string]: unknown };

export const JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

export interface JsonSchemaOptions {
  $id?: string;
  title?: string;
  description?: string;
}

interface EmitState {
  readonly defs: Record<string, JsonSchema>;
  readonly names: Map<Schema, string>;
}

/** The JSON Schema 2020-12 document for `schema`. */
export function toJsonSchema(schema: Schema, options: JsonSchemaOptions = {}): JsonSchema {
  const state: EmitState = { defs: {}, names: new Map() };
  const body = emit(schema as SchemaNode, state);
  const doc: JsonSchema = { $schema: JSON_SCHEMA_DIALECT };
  if (options.$id !== undefined) doc.$id = options.$id;
  if (options.title !== undefined) doc.title = options.title;
  Object.assign(doc, body);
  if (options.description !== undefined) doc.description = options.description;
  if (Object.keys(state.defs).length > 0) doc.$defs = state.defs;
  return doc;
}

function described(out: JsonSchema, description: string | undefined): JsonSchema {
  if (description === undefined) return out;
  const existing = out.description;
  out.description = typeof existing === 'string' ? `${description} ${existing}` : description;
  return out;
}

function appendDescription(out: JsonSchema, text: string): JsonSchema {
  const existing = out.description;
  out.description = typeof existing === 'string' ? `${existing} ${text}` : text;
  return out;
}

function emitString(node: StringSchema): JsonSchema {
  const out: JsonSchema = { type: 'string' };
  if (node.min !== undefined) out.minLength = node.min;
  if (node.max !== undefined) out.maxLength = node.max;
  const patterns: string[] = [];
  if (node.pattern !== undefined) patterns.push(node.pattern);
  if (node.text !== undefined) patterns.push(textPattern(node.text));
  if (patterns.length === 1) out.pattern = patterns[0];
  else if (patterns.length > 1) out.allOf = patterns.map((pattern) => ({ pattern }));
  if (node.not && node.not.length > 0) out.not = { enum: [...node.not] };
  described(out, node.description);
  if (node.trim)
    appendDescription(out, 'Leading and trailing whitespace is trimmed before the length check.');
  return out;
}

function emit(node: SchemaNode, state: EmitState): JsonSchema {
  switch (node.kind) {
    case 'string':
      return emitString(node);
    case 'number': {
      const out: JsonSchema = { type: node.int ? 'integer' : 'number' };
      if (node.min !== undefined) out.minimum = node.min;
      if (node.max !== undefined) out.maximum = node.max;
      return described(out, node.description);
    }
    case 'boolean':
      return described({ type: 'boolean' }, node.description);
    case 'null':
      return described({ type: 'null' }, node.description);
    case 'literal':
      return described({ const: node.value }, node.description);
    case 'enum':
      return described({ type: 'string', enum: [...node.values] }, node.description);
    case 'array': {
      const out: JsonSchema = { type: 'array', items: emit(node.item as SchemaNode, state) };
      if (node.min !== undefined) out.minItems = node.min;
      if (node.max !== undefined) out.maxItems = node.max;
      return described(out, node.description);
    }
    case 'object': {
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const key of Object.keys(node.shape)) {
        const field = node.shape[key] as SchemaNode;
        if (field.kind === 'optional') {
          const property = described(emit(field.inner as SchemaNode, state), field.description);
          if (field.hasDefault) property.default = field.default;
          properties[key] = property;
        } else {
          properties[key] = emit(field, state);
          required.push(key);
        }
      }
      const out: JsonSchema = { type: 'object', properties };
      if (required.length > 0) out.required = required;
      if (node.strict) out.additionalProperties = false;
      return described(out, node.description);
    }
    case 'record': {
      const names: JsonSchema = node.key ? emitString(node.key) : { type: 'string' };
      names.not = { enum: [...UNSAFE_KEYS, ...(node.key?.not ?? [])] };
      const out: JsonSchema = {
        type: 'object',
        propertyNames: names,
        additionalProperties: emit(node.value as SchemaNode, state),
      };
      if (node.min !== undefined) out.minProperties = node.min;
      if (node.max !== undefined) out.maxProperties = node.max;
      return described(out, node.description);
    }
    case 'union': {
      if (node.discriminator === undefined) {
        return described(
          { anyOf: node.options.map((option) => emit(option as SchemaNode, state)) },
          node.description
        );
      }
      const key = node.discriminator;
      const index = discriminatorIndex(node);
      const fallbacks = new Set(index.fallbacks);
      const oneOf = node.options.map((option, i) => {
        const out = emit(option as SchemaNode, state);
        const properties = out.properties as Record<string, JsonSchema> | undefined;
        const field = properties?.[key];
        if (fallbacks.has(i) && field && index.values.length > 0) {
          // A pattern branch must not also match the listed values, or oneOf breaks.
          const refused = [...index.values, ...((field.not as { enum?: unknown[] })?.enum ?? [])];
          field.not = { enum: refused };
        }
        return out;
      });
      return described({ oneOf }, node.description);
    }
    case 'nullable':
      return described(
        { anyOf: [emit(node.inner as SchemaNode, state), { type: 'null' }] },
        node.description
      );
    case 'optional':
      return described(emit(node.inner as SchemaNode, state), node.description);
    case 'lazy':
      return emitLazy(node, state);
    case 'refine': {
      const out = described(emit(node.inner as SchemaNode, state), node.description);
      if (node.description === undefined) appendDescription(out, `Checked by rule "${node.code}".`);
      else appendDescription(out, `(rule "${node.code}")`);
      return out;
    }
    case 'json':
      return emitJson(node, state);
    default:
      return {};
  }
}

function uniqueName(state: EmitState, base: string): string {
  let name = base;
  for (let i = 2; Object.hasOwn(state.defs, name); i++) name = `${base}${i}`;
  return name;
}

function emitLazy(node: LazySchema, state: EmitState): JsonSchema {
  let name = state.names.get(node);
  if (name === undefined) {
    name = uniqueName(state, node.name ?? 'Lazy');
    state.names.set(node, name);
    state.defs[name] = {}; // placeholder: a recursive reference resolves to it
    let target: Schema | undefined;
    try {
      target = node.get();
    } catch {
      target = undefined; // unresolvable: the definition stays `{}` (accepts anything)
    }
    if (target) state.defs[name] = emit(target as SchemaNode, state);
  }
  return described({ $ref: `#/$defs/${name}` }, node.description);
}

/** Bounded JSON unrolls into one definition per remaining depth (exact limits). */
function emitJson(node: JsonValueSchema, state: EmitState): JsonSchema {
  const id = `Json_d${node.depth}_k${node.maxKeys}_i${node.maxItems}_s${node.maxString}_n${node.maxKeyLength}${node.text ? `_${node.text}` : ''}`;
  const name = (depth: number): string => `${id}_${depth}`;
  if (!Object.hasOwn(state.defs, name(node.depth))) {
    const text: JsonSchema = { type: 'string', maxLength: node.maxString };
    if (node.text !== undefined) text.pattern = textPattern(node.text);
    const scalars: JsonSchema[] = [text, { type: 'number' }, { type: 'boolean' }, { type: 'null' }];
    for (let depth = 0; depth <= node.depth; depth++) {
      const options = [...scalars.map((scalar) => ({ ...scalar }))];
      if (depth > 0) {
        const child = { $ref: `#/$defs/${name(depth - 1)}` };
        options.push({ type: 'array', maxItems: node.maxItems, items: child });
        options.push({
          type: 'object',
          maxProperties: node.maxKeys,
          propertyNames: { maxLength: node.maxKeyLength, not: { enum: [...UNSAFE_KEYS] } },
          additionalProperties: child,
        });
      }
      state.defs[name(depth)] = { anyOf: options };
    }
  }
  return described({ $ref: `#/$defs/${name(node.depth)}` }, node.description);
}
