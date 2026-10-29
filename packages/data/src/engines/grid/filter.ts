import {
  boundedString,
  createSchema,
  enumValue,
  recordOf,
  strictKeys,
  ValidationError,
} from '../validation.ts';
import { type GridColumnDef, type GridValueType, normalize, readValue } from './columns.ts';

/**
 * Filters are data: a tree of and/or groups and conditions, stored in saved
 * views and snapshots, validated with bounded runtime parsers and compiled to plain closures
 * (never `eval` or `new Function`).
 */

export const FILTER_OPERATORS = [
  'eq',
  'neq',
  'contains',
  'in',
  'between',
  'before',
  'after',
  'isEmpty',
  'isNotEmpty',
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

type Scalar = string | number | boolean | null;

/**
 * A host operator id from a filter builder catalog (`@texuli/data/filter-builder`):
 * `[a-z][a-zA-Z0-9_-]{0,31}`, never a built-in name. The grid engine refuses
 * conditions on them; the builder's `applyFilter` runs them through the host
 * predicate.
 */
export type FilterCustomOperatorId = string & {};

export interface FilterCondition {
  type: 'condition';
  field: string;
  /** A built-in operator, or a catalog operator id (filter builder only). */
  operator: FilterOperator | FilterCustomOperatorId;
  /** eq/neq: a scalar; contains: text; in: a list; between: [low, high]; before/after: a date. */
  value?: Scalar | Scalar[];
}

export interface FilterGroup {
  type: 'group';
  op: 'and' | 'or';
  children: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

/** Bounds for filters that come from snapshots or other untrusted data. */
export const FILTER_LIMITS = { depth: 6, nodes: 200 } as const;

function isScalar(input: unknown): input is Scalar {
  return (
    input === null ||
    typeof input === 'boolean' ||
    (typeof input === 'number' && Number.isFinite(input)) ||
    (typeof input === 'string' && input.length <= 500)
  );
}

function parseNode(input: unknown): FilterNode {
  const value = recordOf(input, 'filter node');
  if (value.type === 'group') {
    strictKeys(value, ['type', 'op', 'children'], 'filter group');
    if (!Array.isArray(value.children) || value.children.length > FILTER_LIMITS.nodes) {
      throw new ValidationError('filter group children must be an array of at most 200 nodes');
    }
    return {
      type: 'group',
      op: enumValue(value.op, ['and', 'or'], 'group operator'),
      children: value.children.map(parseNode),
    };
  }

  strictKeys(value, ['type', 'field', 'operator', 'value'], 'filter condition');
  if (value.type !== 'condition')
    throw new ValidationError('filter node type must be condition or group');
  const operator = enumValue(value.operator, FILTER_OPERATORS, 'filter operator');
  const field = boundedString(value.field, 'field', 1, 64);
  let conditionValue: FilterCondition['value'];
  if (value.value !== undefined) {
    if (Array.isArray(value.value)) {
      if (value.value.length > 100 || value.value.some((item) => !isScalar(item))) {
        throw new ValidationError('filter value lists must contain at most 100 scalar values');
      }
      conditionValue = [...value.value] as Scalar[];
    } else {
      if (!isScalar(value.value)) throw new ValidationError('filter value must be a scalar');
      conditionValue = value.value;
    }
  }

  if (operator === 'isEmpty' || operator === 'isNotEmpty') {
    if (conditionValue !== undefined) throw new ValidationError(`${operator} takes no value`);
  } else if (operator === 'in') {
    if (!Array.isArray(conditionValue) || conditionValue.length === 0) {
      throw new ValidationError('in needs a non-empty list');
    }
  } else if (operator === 'between') {
    if (!Array.isArray(conditionValue) || conditionValue.length !== 2) {
      throw new ValidationError('between needs [low, high]');
    }
  } else if (operator === 'contains') {
    if (typeof conditionValue !== 'string' || conditionValue === '') {
      throw new ValidationError('contains needs text');
    }
  } else if (operator === 'before' || operator === 'after') {
    if (typeof conditionValue !== 'string' && typeof conditionValue !== 'number') {
      throw new ValidationError(`${operator} needs a date`);
    }
  } else if (conditionValue === undefined || Array.isArray(conditionValue)) {
    throw new ValidationError(`${operator} needs one value`);
  }
  return {
    type: 'condition',
    field,
    operator,
    ...(conditionValue === undefined ? {} : { value: conditionValue }),
  };
}

/**
 * Measures untrusted input without recursion, so a tree nested thousands of
 * levels deep is refused before recursive parsing could overflow the
 * stack. Stops as soon as a limit is exceeded.
 */
export function exceedsFilterLimits(input: unknown): boolean {
  const stack: { node: unknown; depth: number }[] = [{ node: input, depth: 1 }];
  let nodes = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: unknown; depth: number };
    nodes++;
    if (depth > FILTER_LIMITS.depth || nodes > FILTER_LIMITS.nodes) return true;
    const children =
      typeof node === 'object' && node !== null
        ? (node as { children?: unknown }).children
        : undefined;
    if (!Array.isArray(children)) continue;
    if (nodes + stack.length + children.length > FILTER_LIMITS.nodes) return true;
    for (const child of children) stack.push({ node: child, depth: depth + 1 });
  }
  return false;
}

const limitsMessage = `filters are limited to ${FILTER_LIMITS.depth} levels and ${FILTER_LIMITS.nodes} nodes`;

/** The shape of any filter tree (structure, values and size), without knowing the columns. */
export const FilterNodeSchema = createSchema<FilterNode>((input) => {
  if (exceedsFilterLimits(input)) throw new ValidationError(limitsMessage);
  return parseNode(input);
});

/** Operators that make sense for each value type (the filter builder offers these). */
export const OPERATORS_BY_TYPE: Record<GridValueType, readonly FilterOperator[]> = {
  text: ['eq', 'neq', 'contains', 'in', 'isEmpty', 'isNotEmpty'],
  enum: ['eq', 'neq', 'in', 'isEmpty', 'isNotEmpty'],
  number: ['eq', 'neq', 'in', 'between', 'isEmpty', 'isNotEmpty'],
  date: ['eq', 'neq', 'between', 'before', 'after', 'isEmpty', 'isNotEmpty'],
  boolean: ['eq', 'neq', 'isEmpty', 'isNotEmpty'],
};

function valueIssue(column: GridColumnDef<unknown>, value: Scalar): string | null {
  if (value === null) return null;
  if (column.type === 'number' && typeof value !== 'number')
    return `${column.header} compares numbers`;
  if (column.type === 'date' && normalize(value as string | number, 'date') === null) {
    return `${column.header} needs a valid date`;
  }
  if (column.type === 'boolean' && typeof value !== 'boolean')
    return `${column.header} is true or false`;
  if (column.type === 'enum' && column.options && !column.options.includes(String(value))) {
    return `${String(value)} is not an option of ${column.header}`;
  }
  return null;
}

/** `FilterNodeSchema` plus checks against the grid's columns: known fields, fitting operators and values. */
export function filterSchemaFor<T>(columns: readonly GridColumnDef<T>[]) {
  const byKey = new Map(columns.map((column) => [column.key, column as GridColumnDef<unknown>]));
  return createSchema<FilterNode>((input) => {
    const root = FilterNodeSchema.parse(input);
    const visit = (node: FilterNode) => {
      if (node.type === 'group') {
        node.children.forEach(visit);
        return;
      }
      const column = byKey.get(node.field);
      if (!column) throw new ValidationError(`unknown field "${node.field}"`);
      if (!OPERATORS_BY_TYPE[column.type].includes(node.operator as FilterOperator)) {
        throw new ValidationError(
          `${node.operator} does not apply to ${column.header} (${column.type})`
        );
      }
      const values =
        node.value === undefined ? [] : Array.isArray(node.value) ? node.value : [node.value];
      for (const value of values) {
        const issue = valueIssue(column, value);
        if (issue) throw new ValidationError(issue);
      }
    };
    visit(root);
    return root;
  });
}

type Predicate<T> = (row: T) => boolean;

function textKey(value: string | number | null, type: GridValueType): string | number | null {
  return type === 'text' && typeof value === 'string' ? value.toLowerCase() : value;
}

function compileCondition<T>(condition: FilterCondition, column: GridColumnDef<T>): Predicate<T> {
  const { type } = column;
  const read = (row: T) => textKey(normalize(readValue(row, column), type), type);
  const target = (value: Scalar) => textKey(normalize(value, type), type);
  const value = condition.value;
  switch (condition.operator) {
    case 'isEmpty':
      return (row) => read(row) === null;
    case 'isNotEmpty':
      return (row) => read(row) !== null;
    case 'eq':
    case 'neq': {
      const expected = target(value as Scalar);
      const negate = condition.operator === 'neq';
      return (row) => (read(row) === expected) !== negate;
    }
    case 'contains': {
      const needle = String(value).toLowerCase();
      return (row) => {
        const v = read(row);
        return v !== null && String(v).toLowerCase().includes(needle);
      };
    }
    case 'in': {
      const allowed = new Set((value as Scalar[]).map(target));
      return (row) => allowed.has(read(row));
    }
    case 'between': {
      const [low, high] = (value as Scalar[]).map(target) as [number, number];
      return (row) => {
        const v = read(row);
        return typeof v === 'number' && v >= low && v <= high;
      };
    }
    case 'before':
    case 'after': {
      const bound = target(value as Scalar) as number;
      const before = condition.operator === 'before';
      return (row) => {
        const v = read(row);
        return typeof v === 'number' && (before ? v < bound : v > bound);
      };
    }
    default:
      // Catalog operators never reach the engine (its parser refuses them).
      return () => false;
  }
}

function compileNode<T>(
  node: FilterNode,
  byKey: ReadonlyMap<string, GridColumnDef<T>>
): Predicate<T> {
  if (node.type === 'condition')
    return compileCondition(node, byKey.get(node.field) as GridColumnDef<T>);
  const children = node.children.map((child) => compileNode(child, byKey));
  if (children.length === 0) return () => true;
  return node.op === 'and'
    ? (row) => children.every((test) => test(row))
    : (row) => children.some((test) => test(row));
}

/**
 * Validates `ast` against the columns (throws a `ValidationError` for unknown fields,
 * operators that do not fit the column, or bad values) and returns a
 * predicate. Text comparisons ignore case; empty values never match a
 * comparison except `neq` and `isEmpty`; an empty group matches every row.
 */
export function compileFilter<T>(ast: unknown, columns: readonly GridColumnDef<T>[]): Predicate<T> {
  const node = filterSchemaFor(columns).parse(ast);
  return compileNode(node, new Map(columns.map((column) => [column.key, column])));
}
