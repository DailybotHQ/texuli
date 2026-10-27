/**
 * The 0.3.0 interaction contract in code (ADR-008): the closed action set,
 * the closed event vocabulary, the state types, the limits and the name
 * patterns, mirrored from the schemas (`tests/spec.test.ts` asserts they
 * stay equal), plus the helpers that turn a catalog property schema into a
 * dialect schema and build the `$ref` root property schemas resolve against.
 */

import type { SpecPropSchema } from '../generated/typescript/catalog-schema.ts';
import { checkSchemaDocument, DIALECT_URI, isRecord, type Schema } from './dialect.ts';

/** The binding key that reads local state: `{ "$state": name }`. */
export const STATE_BINDING_KEY = '$state';
/** The binding key that reads host data (read-only): `{ "$data": name }`. */
export const DATA_BINDING_KEY = '$data';

/** Every state variable type (`$defs.stateDeclaration.type`). */
export const SPEC_STATE_TYPES = [
  'boolean',
  'number',
  'enum',
  'string',
  'list',
  'workflow',
] as const;
export type SpecStateType = (typeof SPEC_STATE_TYPES)[number];

/** The closed action set (`$defs.action.op`). Never open to code. */
export const SPEC_ACTION_OPS = [
  'setState',
  'toggleState',
  'moveItem',
  'flowGo',
  'emit',
  'submit',
] as const;
export type SpecActionOp = (typeof SPEC_ACTION_OPS)[number];

/** The closed event vocabulary (catalog `$defs.eventName`). */
export const SPEC_EVENT_NAMES = ['press', 'change', 'select', 'submit', 'dismiss', 'move'] as const;
export type SpecEventName = (typeof SPEC_EVENT_NAMES)[number];

/** The `$ref` targets a catalog property schema may name. */
export const SPEC_PROP_REFS = [
  'binding',
  'reorder',
  'action',
  'eventMap',
  'condition',
  'workflowGraph',
] as const;

/** The fields each action op takes (besides `op`) and the ones it needs. */
export const ACTION_FIELDS: Readonly<
  Record<
    SpecActionOp,
    { readonly allowed: readonly string[]; readonly required: readonly string[] }
  >
> = Object.freeze({
  setState: { allowed: ['state', 'value', 'fromEvent'], required: ['state'] },
  toggleState: { allowed: ['state'], required: ['state'] },
  moveItem: { allowed: ['from', 'item', 'to', 'index'], required: ['from', 'item'] },
  flowGo: { allowed: ['event'], required: ['event'] },
  emit: { allowed: ['intent', 'values'], required: ['intent'] },
  submit: { allowed: [], required: [] },
});

/** The fields each state type takes (besides `type`). */
export const STATE_FIELDS: Readonly<Record<SpecStateType, readonly string[]>> = Object.freeze({
  boolean: ['initial', 'source'],
  number: ['min', 'max', 'initial', 'source'],
  enum: ['values', 'initial', 'source'],
  string: ['maxLength', 'initial', 'source'],
  list: ['maxItems', 'initial'],
  workflow: ['initial'],
});

/** Every bound of the contract. Strings are counted in UTF-16 units, like the player. */
export const SPEC_LIMITS = Object.freeze({
  stateVars: 64,
  enumValues: 32,
  enumValueLength: 64,
  stringLength: 1000,
  defaultStringLength: 200,
  flowViews: 16,
  flowTransitions: 64,
  actionsPerEvent: 8,
  emitValues: 32,
  emitValueLength: 2048,
  listItems: 500,
  /** Fields one list item may carry besides its `id`. */
  listItemFields: 16,
  workflowNodes: 500,
  workflowEdges: 2000,
  workflowNodeTypes: 64,
  workflowGroups: 64,
  workflowPorts: 16,
  workflowFields: 32,
  workflowLabelLength: 200,
  workflowStringLength: 2000,
  /** Deepest prop value walked for nested bindings. */
  propDepth: 32,
});

/** The name patterns, as the schemas write them. */
export const SPEC_PATTERNS = Object.freeze({
  stateName: '^[a-z][A-Za-z0-9_]{0,31}$',
  dataName: '^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+)*$',
  flowName: '^[a-z][a-z0-9-]{0,31}$',
  intentName: '^[A-Za-z][A-Za-z0-9_-]{0,63}$',
  itemKey: '^[A-Za-z0-9._:-]{1,64}$',
  groupName: '^[a-z][a-z0-9-]{0,31}$',
  workflowId: '^[A-Za-z0-9._:-]{1,64}$',
  workflowFieldName: '^[a-z][A-Za-z0-9_]{0,31}$',
  /** Multi-line display text (workflow string field values): tab and newline allowed. */
  workflowText: '^[^\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069]*$',
  workflowLabel: '^[^\\u0000-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069]*$',
});

/**
 * The patterns the blueprint validator tests, compiled once; `u` so classes
 * count code points. The workflow validator compiles its own.
 */
export const SPEC_REGEX = Object.freeze({
  stateName: new RegExp(SPEC_PATTERNS.stateName, 'u'),
  dataName: new RegExp(SPEC_PATTERNS.dataName, 'u'),
  intentName: new RegExp(SPEC_PATTERNS.intentName, 'u'),
  itemKey: new RegExp(SPEC_PATTERNS.itemKey, 'u'),
});

/**
 * A catalog property schema as a dialect schema: the same keywords, with
 * every object closed unless `additionalProperties` gives a map.
 */
export function toDialectSchema(schema: SpecPropSchema): Schema {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties' && isRecord(value)) {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [
          name,
          toDialectSchema(child as SpecPropSchema),
        ])
      );
    } else if ((key === 'items' || key === 'additionalProperties') && isRecord(value)) {
      out[key] = toDialectSchema(value as SpecPropSchema);
    } else {
      out[key] = value;
    }
  }
  if (out.type === 'object' && out.additionalProperties === undefined) {
    out.additionalProperties = false;
  }
  return out as Schema;
}

/**
 * Problems with one catalog property schema: it must stay in the dialect,
 * name only {@link SPEC_PROP_REFS} in `$ref`, and give a `type` wherever it
 * has no `$ref`. Empty means usable.
 */
export function checkPropSchema(schema: SpecPropSchema): string[] {
  const issues: string[] = [];
  const dialect = { $schema: DIALECT_URI, ...toDialectSchema(schema) };
  for (const issue of checkSchemaDocument(dialect)) {
    if (issue.code !== 'bad-ref') issues.push(`${issue.path} ${issue.code}`);
  }
  const visit = (node: SpecPropSchema, path: string): void => {
    if (node.$ref !== undefined) {
      const name = /^#\/\$defs\/([A-Za-z]+)$/.exec(node.$ref)?.[1];
      if (name === undefined || !(SPEC_PROP_REFS as readonly string[]).includes(name)) {
        issues.push(`${path}.$ref names no contract $defs entry`);
      }
      if (Object.keys(node).some((key) => key !== '$ref' && key !== 'description')) {
        issues.push(`${path} mixes $ref with other keywords`);
      }
      return;
    }
    if (node.type === undefined) issues.push(`${path} needs a type`);
    for (const [name, child] of Object.entries(node.properties ?? {})) {
      visit(child, `${path}.properties.${name}`);
    }
    if (node.items) visit(node.items, `${path}.items`);
    if (node.additionalProperties) visit(node.additionalProperties, `${path}.additionalProperties`);
  };
  visit(schema, '$');
  return issues;
}

/** Def names both documents declare; the contract root needs them disjoint. */
export function defCollisions(blueprintSchema: Schema, workflowSchema?: Schema): string[] {
  const own = Object.keys(blueprintSchema.$defs ?? {});
  const other = new Set([...Object.keys(workflowSchema?.$defs ?? {}), 'workflowGraph']);
  return own.filter((name) => other.has(name));
}

/**
 * The root property schemas resolve `$ref`s against: the blueprint `$defs`,
 * the workflow `$defs` and a synthetic `workflowGraph` (the workflow root).
 * Without a workflow schema there is no `workflowGraph`, so a property that
 * names it fails closed.
 */
export function contractRoot(blueprintSchema: Schema, workflowSchema?: Schema): Schema {
  const defs: Record<string, Schema> = { ...(blueprintSchema.$defs ?? {}) };
  if (workflowSchema) {
    Object.assign(defs, workflowSchema.$defs ?? {});
    const { $schema: _s, $id: _i, $defs: _d, title: _t, ...graph } = workflowSchema;
    defs.workflowGraph = graph;
  }
  return { $defs: defs };
}
