import {
  type GridColumnDef,
  type GridValue,
  type GridValueType,
  normalize,
  readValue,
} from '../engines/grid/columns.ts';
import {
  compileFilter,
  exceedsFilterLimits,
  FILTER_LIMITS,
  FILTER_OPERATORS,
  type FilterCondition,
  type FilterCustomOperatorId,
  type FilterGroup,
  type FilterNode,
  type FilterOperator,
  filterSchemaFor,
  OPERATORS_BY_TYPE,
} from '../engines/grid/filter.ts';
import {
  boundedString,
  createSchema,
  type DataSchema,
  enumValue,
  recordOf,
  strictKeys,
  ValidationError,
} from '../engines/validation.ts';

/**
 * The property catalog extension of the filter builder (G49): host
 * operators with a typed value editor, validation and a predicate; field
 * groups; and saved segments that carry their metadata with the model.
 * Everything stays data: an operator is an id in the saved JSON, and the
 * host code that runs it (`test`) lives in the catalog, never in the model.
 */

/** The value editor a host operator shows, and the value shape it stores. */
export type FilterValueEditor =
  | 'none'
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'option'
  | 'options'
  | 'range';

export const FILTER_VALUE_EDITORS: readonly FilterValueEditor[] = [
  'none',
  'text',
  'number',
  'date',
  'boolean',
  'option',
  'options',
  'range',
];

/** The value of a condition (a scalar, a list or a `[low, high]` pair). */
export type FilterValue = FilterCondition['value'];

/** Any operator a condition can hold: built-in, or a catalog id. */
export type FilterAnyOperator = FilterOperator | FilterCustomOperatorId;

/**
 * A field the builder offers: a grid column (`key`, `header`, `type`,
 * `options` for enums, `accessor`), so DataGrid columns can be passed as-is,
 * plus the catalog extras: a `group` id (see `FilterFieldGroup`) and the
 * `operators` it offers, in menu order (built-in or catalog ids; default:
 * the built-ins of its type, then every catalog operator that fits it). `T`
 * is the row type; the bare `FilterField` accepts fields of any row type.
 */
export type FilterField<T = never> = Pick<
  GridColumnDef<T>,
  'key' | 'header' | 'type' | 'options' | 'accessor'
> & {
  group?: string;
  operators?: readonly FilterAnyOperator[];
};

/**
 * A host operator. `id` is what the saved model stores
 * (`[a-z][a-zA-Z0-9_-]{0,31}`, never a built-in name). `editor` picks the
 * value control and the value shape: `none` (no value), `text`, `number`,
 * `date`, `boolean`, `option` (one of `options`), `options` (a non-empty
 * list of them) or `range` (`[low, high]`, numbers, or dates on a date
 * field). `options` default to the field's.
 */
export interface FilterOperatorDef<T = never> {
  id: string;
  /** The operator menu text. */
  label: string;
  editor: FilterValueEditor;
  /** Field types that offer it when a field lists no `operators` (default: every type). */
  types?: readonly GridValueType[];
  options?: readonly string[];
  /** The starting value (default: by editor, like the built-ins). */
  defaultValue?: FilterValue;
  /** An extra check of a value that already has the editor's shape: a message refuses it. */
  validate?(value: FilterValue, field: FilterField<T>): string | null | undefined;
  /** Whether a row matches: the cell (through the field's accessor), the value and the row. */
  test(cell: GridValue, value: FilterValue, row: T): boolean;
}

/** A labeled group of fields in the field menu (`<optgroup>`). */
export interface FilterFieldGroup {
  id: string;
  label: string;
}

const OPERATOR_ID = /^[a-z][a-zA-Z0-9_-]{0,31}$/;
const BUILT_IN = new Set<string>(FILTER_OPERATORS);
const limitsMessage = `filters are limited to ${FILTER_LIMITS.depth} levels and ${FILTER_LIMITS.nodes} nodes`;

type Catalog = ReadonlyMap<string, FilterOperatorDef<unknown>>;
const EMPTY_CATALOG: Catalog = new Map();
const catalogs = new WeakMap<readonly unknown[], Catalog>();

/**
 * The operators by id, validated once per array. Throws a `TypeError` on a
 * bad or built-in id, a duplicate, an empty label, an unknown editor or a
 * missing `test`: these are developer errors.
 */
export function operatorCatalog<T>(operators?: readonly FilterOperatorDef<T>[]): Catalog {
  if (!operators || operators.length === 0) return EMPTY_CATALOG;
  const cached = catalogs.get(operators);
  if (cached) return cached;
  const byId = new Map<string, FilterOperatorDef<unknown>>();
  for (const def of operators) {
    if (typeof def?.id !== 'string' || !OPERATOR_ID.test(def.id) || BUILT_IN.has(def.id))
      throw new TypeError(`Filter operator id "${String(def?.id)}" is not allowed.`);
    if (byId.has(def.id)) throw new TypeError(`Filter operator "${def.id}" is defined twice.`);
    if (typeof def.label !== 'string' || def.label.trim() === '')
      throw new TypeError(`Filter operator "${def.id}" needs a label.`);
    if (!FILTER_VALUE_EDITORS.includes(def.editor))
      throw new TypeError(`Filter operator "${def.id}" has an unknown editor.`);
    if (typeof def.test !== 'function')
      throw new TypeError(`Filter operator "${def.id}" needs a test.`);
    byId.set(def.id, def as unknown as FilterOperatorDef<unknown>);
  }
  catalogs.set(operators, byId);
  return byId;
}

const fits = (def: FilterOperatorDef<unknown>, field: Pick<FilterField, 'type'>) =>
  !def.types || def.types.includes(field.type);

/**
 * The operators a field offers, in menu order: its own `operators` list
 * (built-ins of its type and known catalog ids), else the built-ins of its
 * type followed by the catalog operators that fit it.
 */
export function offeredOperators<T>(
  field: Pick<FilterField, 'type' | 'operators'>,
  operators?: readonly FilterOperatorDef<T>[]
): readonly FilterAnyOperator[] {
  const builtIns: readonly string[] = OPERATORS_BY_TYPE[field.type];
  const catalog = operatorCatalog(operators);
  if (field.operators) {
    return field.operators.filter((id) => {
      const def = catalog.get(id);
      return builtIns.includes(id) || (def !== undefined && fits(def, field));
    });
  }
  if (catalog.size === 0) return OPERATORS_BY_TYPE[field.type];
  return [
    ...OPERATORS_BY_TYPE[field.type],
    ...[...catalog.values()].filter((def) => fits(def, field)).map((def) => def.id),
  ];
}

/** The value editor of any operator on `field` (built-ins map to theirs). */
export function editorOf<T>(
  operator: FilterAnyOperator,
  field: Pick<FilterField, 'type'>,
  operators?: readonly FilterOperatorDef<T>[]
): FilterValueEditor {
  const def = operatorCatalog(operators).get(operator);
  if (def) return def.editor;
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return 'none';
  if (operator === 'in') return 'options';
  if (operator === 'between') return 'range';
  if (field.type === 'boolean') return 'boolean';
  if (field.type === 'enum' && operator !== 'contains') return 'option';
  if (field.type === 'number') return 'number';
  if (field.type === 'date') return 'date';
  return 'text';
}

/** The catalog definition of an operator id, if it is one. */
export function customOperator<T>(
  operator: string,
  operators?: readonly FilterOperatorDef<T>[]
): FilterOperatorDef<T> | undefined {
  return operatorCatalog(operators).get(operator) as FilterOperatorDef<T> | undefined;
}

type Scalar = string | number | boolean | null;
const blank = (value: unknown) => value === undefined || value === null || value === '';

/** Whether a value is complete for an editor (the shape a condition needs to run). */
export function completeFor(editor: FilterValueEditor, value: FilterValue): boolean {
  if (editor === 'none') return true;
  if (editor === 'options') return Array.isArray(value) && value.length > 0 && !value.some(blank);
  if (editor === 'range') return Array.isArray(value) && value.length === 2 && !value.some(blank);
  return !Array.isArray(value) && !blank(value);
}

/** The starting value of a catalog operator. */
export function customDefault<T>(def: FilterOperatorDef<T>, field: FilterField): FilterValue {
  if (def.defaultValue !== undefined) return def.defaultValue;
  switch (def.editor) {
    case 'boolean':
      return true;
    case 'option':
      return (def.options ?? field.options)?.[0];
    case 'options':
      return [];
    case 'range':
      return [null, null];
    default:
      return undefined;
  }
}

const isDate = (value: unknown) =>
  (typeof value === 'string' && value.length <= 500) || typeof value === 'number'
    ? normalize(value as string | number, 'date') !== null
    : false;

function checkValue(
  def: FilterOperatorDef<unknown>,
  field: FilterField,
  raw: unknown
): FilterValue {
  const options = def.options ?? field.options;
  const option = (value: unknown, name: string): string => {
    const text = boundedString(value, name, 1, 500);
    if (options && !options.includes(text))
      throw new ValidationError(`${text} is not an option of ${field.header}`);
    return text;
  };
  const needs = (what: string) => new ValidationError(`${def.label} needs ${what}`);
  switch (def.editor) {
    case 'none':
      if (raw !== undefined) throw new ValidationError(`${def.label} takes no value`);
      return undefined;
    case 'text':
      if (typeof raw !== 'string' || raw === '' || raw.length > 500) throw needs('text');
      return raw;
    case 'number':
      if (typeof raw !== 'number' || !Number.isFinite(raw)) throw needs('a number');
      return raw;
    case 'date':
      if (!isDate(raw)) throw needs('a valid date');
      return raw as string | number;
    case 'boolean':
      if (typeof raw !== 'boolean') throw needs('true or false');
      return raw;
    case 'option':
      return option(raw, 'value');
    case 'options':
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100)
        throw needs('a list of 1 to 100 options');
      return raw.map((entry) => option(entry, 'value'));
    case 'range': {
      if (!Array.isArray(raw) || raw.length !== 2) throw needs('[low, high]');
      const ok = (value: unknown) =>
        field.type === 'date' ? isDate(value) : typeof value === 'number' && Number.isFinite(value);
      if (!raw.every(ok)) throw needs(field.type === 'date' ? 'two dates' : 'two numbers');
      return [...raw] as Scalar[];
    }
  }
}

function hostMessage(def: FilterOperatorDef<unknown>, value: FilterValue, field: FilterField) {
  let message: unknown;
  try {
    message = def.validate?.(value, field as FilterField<unknown>);
  } catch {
    message = `${def.label} refused the value`;
  }
  return typeof message === 'string' && message !== '' ? message.slice(0, 200) : null;
}

const customized = <T>(
  fields: readonly FilterField<T>[],
  operators?: readonly FilterOperatorDef<T>[]
) => (operators?.length ?? 0) > 0 || fields.some((field) => field.operators !== undefined);

/**
 * The schema of a model against a catalog: the grid engine's checks for
 * built-in conditions, plus each field's `operators` list, and for catalog
 * operators the editor's value shape and the host `validate`. Bounded like
 * the engine (`FILTER_LIMITS` is measured first, without recursion).
 */
export function catalogSchema<T>(
  fields: readonly FilterField<T>[],
  operators?: readonly FilterOperatorDef<T>[]
): DataSchema<FilterNode> {
  const builtIn = filterSchemaFor(fields as readonly GridColumnDef<T>[]);
  if (!customized(fields, operators)) return builtIn;
  const catalog = operatorCatalog(operators);
  const byKey = new Map(fields.map((field) => [field.key, field as FilterField]));
  const offered = (field: FilterField, operator: string) => {
    if (!offeredOperators(field, operators).includes(operator))
      throw new ValidationError(`${operator} does not apply to ${field.header} (${field.type})`);
  };
  const condition = (value: Record<string, unknown>): FilterCondition => {
    const def = typeof value.operator === 'string' ? catalog.get(value.operator) : undefined;
    if (!def) {
      const node = builtIn.parse(value) as FilterCondition;
      offered(byKey.get(node.field) as FilterField, node.operator);
      return node;
    }
    strictKeys(value, ['type', 'field', 'operator', 'value'], 'filter condition');
    if (value.type !== 'condition')
      throw new ValidationError('filter node type must be condition or group');
    const key = boundedString(value.field, 'field', 1, 64);
    const field = byKey.get(key);
    if (!field) throw new ValidationError(`unknown field "${key}"`);
    offered(field, def.id);
    const checked = checkValue(def, field, value.value);
    const message = hostMessage(def, checked, field);
    if (message) throw new ValidationError(message);
    return {
      type: 'condition',
      field: key,
      operator: def.id,
      ...(checked === undefined ? {} : { value: checked }),
    };
  };
  const visit = (input: unknown): FilterNode => {
    const value = recordOf(input, 'filter node');
    if (value.type !== 'group') return condition(value);
    strictKeys(value, ['type', 'op', 'children'], 'filter group');
    if (!Array.isArray(value.children) || value.children.length > FILTER_LIMITS.nodes)
      throw new ValidationError('filter group children must be an array of at most 200 nodes');
    return {
      type: 'group',
      op: enumValue(value.op, ['and', 'or'], 'group operator'),
      children: value.children.map(visit),
    };
  };
  return createSchema<FilterNode>((input) => {
    if (exceedsFilterLimits(input)) throw new ValidationError(limitsMessage);
    return visit(input);
  });
}

/**
 * A predicate for a model (validated by `catalogSchema`; throws a
 * `ValidationError`): built-in conditions compile in the grid engine, and
 * catalog conditions call the host `test` with the cell read through the
 * field's accessor. A host `test` that throws does not match.
 */
export function compileCatalogFilter<T>(
  model: unknown,
  fields: readonly FilterField<T>[],
  operators?: readonly FilterOperatorDef<T>[]
): (row: T) => boolean {
  const columns = fields as readonly GridColumnDef<T>[];
  if (!customized(fields, operators)) return compileFilter<T>(model, columns);
  const root = catalogSchema(fields, operators).parse(model);
  const catalog = operatorCatalog(operators);
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const compile = (node: FilterNode): ((row: T) => boolean) => {
    if (node.type === 'group') {
      const children = node.children.map(compile);
      if (children.length === 0) return () => true;
      return node.op === 'and'
        ? (row) => children.every((test) => test(row))
        : (row) => children.some((test) => test(row));
    }
    const column = byKey.get(node.field) as GridColumnDef<T>;
    const def = catalog.get(node.operator) as FilterOperatorDef<T> | undefined;
    if (!def) return compileFilter<T>(node, [column]);
    const value = node.value;
    return (row) => {
      try {
        return def.test(readValue(row, column), value, row) === true;
      } catch {
        return false;
      }
    };
  };
  return compile(root);
}

/**
 * The field menu in sections: ungrouped fields first, then each group in
 * `groups` order, then groups only named by fields (labeled by their id).
 */
export function groupFields<F extends Pick<FilterField, 'group'>>(
  fields: readonly F[],
  groups: readonly FilterFieldGroup[] = []
): { group: FilterFieldGroup | null; fields: F[] }[] {
  const sections = new Map<string | null, { group: FilterFieldGroup | null; fields: F[] }>();
  sections.set(null, { group: null, fields: [] });
  for (const group of groups) sections.set(group.id, { group, fields: [] });
  for (const field of fields) {
    const id = field.group ?? null;
    let section = sections.get(id);
    if (!section) {
      section = { group: { id: id as string, label: id as string }, fields: [] };
      sections.set(id, section);
    }
    section.fields.push(field);
  }
  return [...sections.values()].filter((section) => section.fields.length > 0);
}

// ---------------------------------------------------------------------------
// Saved segments

/**
 * A saved filter with its metadata: what a host stores, lists and shares.
 * `filter` is the builder's model (`bind:value={segment.filter}`).
 */
export interface FilterSegment {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  /** ISO 8601 date or date-time. */
  updatedAt?: string;
  filter: FilterGroup;
}

export const FILTER_SEGMENT_LIMITS = Object.freeze({
  id: 128,
  name: 120,
  description: 2_000,
  owner: 128,
  /** Longest serialized segment `parseSegment` reads. */
  json: 200_000,
});

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

const SEGMENT_KEYS = ['id', 'name', 'description', 'owner', 'updatedAt', 'filter'] as const;

/** A segment in canonical key order, optional fields left out when absent. */
function canonical(segment: FilterSegment): FilterSegment {
  const out: Record<string, unknown> = {};
  for (const key of SEGMENT_KEYS) if (segment[key] !== undefined) out[key] = segment[key];
  return out as unknown as FilterSegment;
}

/**
 * Reads a saved segment (untrusted: an object or its JSON text) against the
 * fields and catalog operators; throws a `ValidationError`. Metadata is
 * bounded (`FILTER_SEGMENT_LIMITS`), `updatedAt` must be an ISO date, and a
 * bare condition as `filter` is wrapped in an `and` group.
 */
export function parseSegment<T>(
  input: unknown,
  fields: readonly FilterField<T>[],
  operators?: readonly FilterOperatorDef<T>[]
): FilterSegment {
  let raw = input;
  if (typeof input === 'string') {
    if (input.length > FILTER_SEGMENT_LIMITS.json)
      throw new ValidationError('segment JSON is too long');
    try {
      raw = JSON.parse(input);
    } catch {
      throw new ValidationError('segment must be valid JSON');
    }
  }
  const value = recordOf(raw, 'segment');
  strictKeys(value, SEGMENT_KEYS, 'segment');
  const optional = (key: 'description' | 'owner', max: number) =>
    value[key] === undefined ? undefined : boundedString(value[key], key, 0, max);
  let updatedAt: string | undefined;
  if (value.updatedAt !== undefined) {
    updatedAt = boundedString(value.updatedAt, 'updatedAt', 10, 40);
    if (!ISO_DATE.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt)))
      throw new ValidationError('updatedAt must be an ISO 8601 date');
  }
  const node = catalogSchema(fields, operators).parse(value.filter);
  return canonical({
    id: boundedString(value.id, 'id', 1, FILTER_SEGMENT_LIMITS.id),
    name: boundedString(value.name, 'name', 1, FILTER_SEGMENT_LIMITS.name),
    description: optional('description', FILTER_SEGMENT_LIMITS.description),
    owner: optional('owner', FILTER_SEGMENT_LIMITS.owner),
    updatedAt,
    filter: node.type === 'group' ? node : { type: 'group', op: 'and', children: [node] },
  });
}

/** A segment as JSON text in canonical key order; `parseSegment` reads it back. */
export function serializeSegment(segment: FilterSegment): string {
  return JSON.stringify(canonical(segment));
}
