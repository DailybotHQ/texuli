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
export type StateDeclaration = (
  | { type: 'boolean'; initial: boolean }
  | { type: 'number'; min: number; max: number; initial: number }
  | { type: 'enum'; values: readonly string[]; initial: string }
  | { type: 'string'; maxLength: number; initial: string }
) & { source?: string };

export type StateValue = boolean | number | string;
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
    | 'host-binding';
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
    default:
      return fail('state-type', `"${name}" has an unknown type.`);
  }
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
