/** Most state variables one blueprint may declare (player design §5, Phase 3). */
export const MAX_STATE_VARS = 64;
/** Most values one `enum` variable may list. */
export const MAX_ENUM_VALUES = 32;
/** Longest enum value or default string cap. */
export const MAX_ENUM_VALUE_LENGTH = 64;
/** Upper bound on a `string` variable's `maxLength`. */
export const MAX_STRING_LENGTH = 1000;
/** `maxLength` when a `string` variable declares none. */
export const DEFAULT_STRING_LENGTH = 200;

const NAME = /^[a-z][A-Za-z0-9_]{0,31}$/;

/**
 * A host data source name (host G01): letters, digits and `_` in dotted
 * segments, such as `tickets.open`, at most 64 characters.
 */
export const DATA_SOURCE_NAME = /^(?=.{1,64}$)[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/;

/**
 * One typed, bounded state variable. There are no objects or arrays. With
 * a `source`, the variable is host-bound: its value comes from the host's
 * data under that name, and only the host can change it.
 */
/** Most items a list variable holds, and most scalar fields per item (spec 0.3.0). */
export const MAX_LIST_ITEMS = 500;
export const MAX_ITEM_FIELDS = 16;
/** A list item key: the spec `itemKey`. */
export const ITEM_KEY = /^[A-Za-z0-9._:-]{1,64}$/;
const ITEM_FIELD = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const MAX_ITEM_TEXT = 2000;

/** One list item: an id and up to 16 scalar fields. */
export type ListItem = Readonly<Record<string, string | number | boolean>> & {
  readonly id: string;
};

/**
 * A workflow graph value (spec `WorkflowGraph`). The state layer checks its
 * envelope (version, bounded lists); the workflow painter runs the full
 * workflow model checks before anything paints.
 */
export type WorkflowValue = Readonly<Record<string, unknown>>;

export type StateDeclaration = (
  | { type: 'boolean'; initial: boolean }
  | { type: 'number'; min: number; max: number; initial: number }
  | { type: 'enum'; values: readonly string[]; initial: string }
  | { type: 'string'; maxLength: number; initial: string }
  | { type: 'list'; maxItems: number; initial: readonly ListItem[] }
  | { type: 'workflow'; initial: WorkflowValue }
) & { source?: string };

export type StateValue = boolean | number | string | readonly ListItem[] | WorkflowValue;
export type StateDeclarations = Readonly<Record<string, StateDeclaration>>;
export type StateSnapshot = Readonly<Record<string, StateValue>>;

/** A problem with the declared state or a binding; always an error. */
export interface StateIssue {
  code:
    | 'state-shape'
    | 'state-limit'
    | 'state-name'
    | 'state-type'
    | 'state-initial'
    | 'unknown-state'
    | 'binding-depth'
    | 'control-binding'
    | 'flow-shape'
    | 'flow-binding'
    | 'action-binding'
    | 'host-binding'
    | 'binding'
    | 'action';
  path: string;
  message: string;
}

export type StateParse =
  | { ok: true; declarations: StateDeclarations }
  | { ok: false; issues: readonly StateIssue[] };

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseOne(name: string, raw: unknown, issues: StateIssue[]): StateDeclaration | null {
  const path = `state.${name}`;
  const fail = (code: StateIssue['code'], message: string): null => {
    issues.push({ code, path, message });
    return null;
  };
  if (!isBag(raw)) return fail('state-shape', `"${name}" must be an object with a type.`);
  const allowed: Record<string, readonly string[]> = {
    boolean: ['type', 'initial', 'source'],
    number: ['type', 'min', 'max', 'initial', 'source'],
    enum: ['type', 'values', 'initial', 'source'],
    string: ['type', 'maxLength', 'initial', 'source'],
    list: ['type', 'maxItems', 'initial'],
    workflow: ['type', 'initial'],
  };
  const keys = typeof raw.type === 'string' ? allowed[raw.type] : undefined;
  if (!keys) return fail('state-type', `"${name}" has an unknown type.`);
  const extra = Object.keys(raw).find((key) => !keys.includes(key));
  if (extra) return fail('state-shape', `"${name}" has an unknown field "${extra}".`);

  switch (raw.type) {
    case 'boolean': {
      const initial = raw.initial ?? false;
      if (typeof initial !== 'boolean') return fail('state-initial', `"${name}" needs a boolean.`);
      return { type: 'boolean', initial };
    }
    case 'number': {
      const { min, max } = raw;
      if (!finite(min) || !finite(max) || min > max) {
        return fail('state-shape', `"${name}" needs finite min ≤ max.`);
      }
      const initial = raw.initial ?? min;
      if (!finite(initial) || initial < min || initial > max) {
        return fail('state-initial', `"${name}" initial must be between ${min} and ${max}.`);
      }
      return { type: 'number', min, max, initial };
    }
    case 'enum': {
      const { values } = raw;
      if (
        !Array.isArray(values) ||
        values.length === 0 ||
        values.length > MAX_ENUM_VALUES ||
        !values.every(
          (value) =>
            typeof value === 'string' && value !== '' && value.length <= MAX_ENUM_VALUE_LENGTH
        ) ||
        new Set(values).size !== values.length
      ) {
        return fail(
          'state-shape',
          `"${name}" needs 1–${MAX_ENUM_VALUES} distinct non-empty strings of at most ${MAX_ENUM_VALUE_LENGTH} characters.`
        );
      }
      const initial = raw.initial ?? values[0];
      if (typeof initial !== 'string' || !values.includes(initial)) {
        return fail('state-initial', `"${name}" initial must be one of its values.`);
      }
      return { type: 'enum', values: Object.freeze([...values]) as readonly string[], initial };
    }
    case 'string': {
      const maxLength = raw.maxLength ?? DEFAULT_STRING_LENGTH;
      if (
        typeof maxLength !== 'number' ||
        !Number.isInteger(maxLength) ||
        maxLength < 1 ||
        maxLength > MAX_STRING_LENGTH
      ) {
        return fail('state-shape', `"${name}" maxLength must be 1–${MAX_STRING_LENGTH}.`);
      }
      const initial = raw.initial ?? '';
      if (typeof initial !== 'string' || initial.length > maxLength) {
        return fail('state-initial', `"${name}" initial must be a string of at most ${maxLength}.`);
      }
      return { type: 'string', maxLength, initial };
    }
    case 'list': {
      const maxItems = raw.maxItems ?? MAX_LIST_ITEMS;
      if (
        typeof maxItems !== 'number' ||
        !Number.isInteger(maxItems) ||
        maxItems < 0 ||
        maxItems > MAX_LIST_ITEMS
      ) {
        return fail('state-shape', `"${name}" maxItems must be 0–${MAX_LIST_ITEMS}.`);
      }
      const initial = coerceList(raw.initial ?? [], maxItems);
      if (!initial) {
        return fail(
          'state-initial',
          `"${name}" initial must be at most ${maxItems} items, each { id, scalar fields }.`
        );
      }
      return { type: 'list', maxItems, initial };
    }
    case 'workflow': {
      const initial = coerceWorkflow(raw.initial);
      if (!initial)
        return fail('state-initial', `"${name}" initial must be a workflow graph (version 1).`);
      return { type: 'workflow', initial };
    }
    default:
      return fail('state-type', `"${name}" has an unknown type.`);
  }
}

/** A frozen copy of a list value, or `undefined` when it does not fit. */
export function coerceList(value: unknown, maxItems: number): readonly ListItem[] | undefined {
  if (!Array.isArray(value) || value.length > maxItems) return undefined;
  const seen = new Set<string>();
  const out: ListItem[] = [];
  for (const raw of value) {
    if (!isBag(raw) || typeof raw.id !== 'string' || !ITEM_KEY.test(raw.id) || seen.has(raw.id)) {
      return undefined;
    }
    seen.add(raw.id);
    const keys = Object.keys(raw);
    if (keys.length > MAX_ITEM_FIELDS + 1) return undefined;
    const item: Record<string, string | number | boolean> = {};
    for (const key of keys) {
      const field = raw[key];
      if (key !== 'id' && !ITEM_FIELD.test(key)) return undefined;
      if (typeof field === 'string') {
        if (field.length > MAX_ITEM_TEXT) return undefined;
      } else if (typeof field === 'number') {
        if (!Number.isFinite(field)) return undefined;
      } else if (typeof field !== 'boolean') {
        return undefined;
      }
      Object.defineProperty(item, key, { value: field, enumerable: true });
    }
    out.push(Object.freeze(item) as ListItem);
  }
  return Object.freeze(out);
}

const MAX_WORKFLOW_NODES = 500;
const MAX_WORKFLOW_EDGES = 2000;

/**
 * A workflow value's envelope: version 1 with bounded node type, node and
 * edge lists. The full checks (ports, cycles, labels) run in the painter.
 */
export function coerceWorkflow(value: unknown): WorkflowValue | undefined {
  if (!isBag(value) || value.version !== 1) return undefined;
  const { nodeTypes, nodes, edges } = value;
  if (!Array.isArray(nodeTypes) || nodeTypes.length === 0 || nodeTypes.length > 64)
    return undefined;
  if (!Array.isArray(nodes) || nodes.length > MAX_WORKFLOW_NODES) return undefined;
  if (!Array.isArray(edges) || edges.length > MAX_WORKFLOW_EDGES) return undefined;
  return Object.freeze({ ...value });
}

/**
 * Read untrusted state declarations strictly: bounded count, safe names,
 * closed types and fields, and an initial value of the declared type. Any
 * issue refuses the whole block (fail closed). Never throws.
 */
export function parseStateDeclarations(input: unknown): StateParse {
  if (!isBag(input)) {
    return {
      ok: false,
      issues: [{ code: 'state-shape', path: 'state', message: 'state must be an object.' }],
    };
  }
  const names = Object.keys(input);
  if (names.length > MAX_STATE_VARS) {
    return {
      ok: false,
      issues: [
        {
          code: 'state-limit',
          path: 'state',
          message: `At most ${MAX_STATE_VARS} state variables (got ${names.length}).`,
        },
      ],
    };
  }
  const issues: StateIssue[] = [];
  const declarations: Record<string, StateDeclaration> = Object.create(null);
  for (const name of names) {
    if (!NAME.test(name)) {
      issues.push({
        code: 'state-name',
        path: `state.${name}`,
        message: `"${name}" is not a valid state name (a lowercase letter, then letters, digits or _; at most 32).`,
      });
      continue;
    }
    const declaration = parseOne(name, input[name], issues);
    if (!declaration) continue;
    const source = (input[name] as Record<string, unknown>).source;
    if (source !== undefined && (typeof source !== 'string' || !DATA_SOURCE_NAME.test(source))) {
      issues.push({
        code: 'state-shape',
        path: `state.${name}.source`,
        message: `"${name}" source must be a data source name like "tickets.open".`,
      });
      continue;
    }
    declarations[name] = Object.freeze(
      source === undefined ? declaration : { ...declaration, source }
    );
  }
  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, declarations: Object.freeze(declarations) };
}

/** The value `value` becomes for `declaration`, or `undefined` when it does not fit. */
export function coerceStateValue(
  declaration: StateDeclaration,
  value: unknown
): StateValue | undefined {
  switch (declaration.type) {
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
    case 'number':
      return finite(value) && value >= declaration.min && value <= declaration.max
        ? value
        : undefined;
    case 'enum':
      return typeof value === 'string' && declaration.values.includes(value) ? value : undefined;
    case 'string':
      return typeof value === 'string' && value.length <= declaration.maxLength ? value : undefined;
    case 'list':
      return coerceList(value, declaration.maxItems);
    case 'workflow':
      return coerceWorkflow(value);
  }
}

/** Every variable at its initial value, then any `overrides` that fit their declaration. */
export function initialSnapshot(
  declarations: StateDeclarations,
  overrides?: Readonly<Record<string, unknown>>
): StateSnapshot {
  const out: Record<string, StateValue> = {};
  for (const [name, declaration] of Object.entries(declarations)) {
    const override =
      overrides && Object.hasOwn(overrides, name)
        ? coerceStateValue(declaration, overrides[name])
        : undefined;
    out[name] = override ?? declaration.initial;
  }
  return Object.freeze(out);
}
