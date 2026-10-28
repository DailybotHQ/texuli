import type { GridColumnDef, GridValueType } from '../engines/grid/columns.ts';
import {
  compileFilter,
  FILTER_LIMITS,
  type FilterCondition,
  type FilterGroup,
  type FilterNode,
  type FilterOperator,
  filterSchemaFor,
  OPERATORS_BY_TYPE,
} from '../engines/grid/filter.ts';

/**
 * The filter builder's model is the grid engine's filter AST (`FilterGroup`
 * at the root, `FilterCondition` leaves): plain JSON that saves, loads
 * (`parseFilter`) and runs (`applyFilter`, or a DataGrid's `filter`). These
 * helpers edit it immutably by path, so a view, a test or a server can share
 * them. A condition being authored may be incomplete (no value yet);
 * `pruneFilter` drops those before the filter runs.
 */

/**
 * A field the builder offers: a grid column (`key`, `header`, `type`,
 * `options` for enums, `accessor`). DataGrid columns can be passed as-is.
 * `T` is the row type; the bare `FilterField` accepts fields of any row type.
 */
export type FilterField<T = never> = Pick<
  GridColumnDef<T>,
  'key' | 'header' | 'type' | 'options' | 'accessor'
>;

/** A node's position: child indexes from the root group (`[]` is the root). */
export type FilterPath = readonly number[];

type Value = FilterCondition['value'];

/** An empty root group (matches every row). */
export function emptyFilter(op: FilterGroup['op'] = 'and'): FilterGroup {
  return { type: 'group', op, children: [] };
}

/** The operators that fit a field's type, in menu order. */
export function operatorsFor(field: Pick<FilterField, 'type'>): readonly FilterOperator[] {
  return OPERATORS_BY_TYPE[field.type];
}

/** The starting value of an operator: booleans start true, enums at their first option, the rest empty. */
export function defaultValue(operator: FilterOperator, field: FilterField): Value {
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return undefined;
  if (operator === 'in') return [];
  if (operator === 'between') return [null, null];
  if (field.type === 'boolean') return true;
  if (field.type === 'enum' && field.options?.[0] !== undefined && operator !== 'contains') {
    return field.options[0];
  }
  return undefined;
}

/** A new condition on `field`: `contains` for text, else its first operator, with that operator's starting value. */
export function newCondition(field: FilterField): FilterCondition {
  const operator = field.type === 'text' ? 'contains' : (operatorsFor(field)[0] as FilterOperator);
  return withValue(
    { type: 'condition', field: field.key, operator },
    defaultValue(operator, field)
  );
}

function withValue(condition: FilterCondition, value: Value): FilterCondition {
  const { value: _drop, ...rest } = condition;
  return value === undefined ? rest : { ...rest, value };
}

const blank = (value: unknown) => value === undefined || value === null || value === '';

/** True when a condition can run: it has every value its operator needs. */
export function isComplete(condition: FilterCondition): boolean {
  const { operator, value } = condition;
  if (operator === 'isEmpty' || operator === 'isNotEmpty') return true;
  if (operator === 'in') return Array.isArray(value) && value.length > 0 && !value.some(blank);
  if (operator === 'between')
    return Array.isArray(value) && value.length === 2 && !value.some(blank);
  return !Array.isArray(value) && !blank(value);
}

/** The node at `path`, or `undefined`. */
export function nodeAt(root: FilterGroup, path: FilterPath): FilterNode | undefined {
  let node: FilterNode | undefined = root;
  for (const index of path) node = node?.type === 'group' ? node.children[index] : undefined;
  return node;
}

/** Depth of `path`'s node: the root group is 1. */
export const depthOf = (path: FilterPath) => path.length + 1;

function updateAt(
  root: FilterGroup,
  path: FilterPath,
  update: (node: FilterNode) => FilterNode | null
): FilterGroup {
  const visit = (node: FilterNode, rest: FilterPath): FilterNode | null => {
    if (rest.length === 0) return update(node);
    if (node.type !== 'group') return node;
    const [index, ...tail] = rest;
    const children: FilterNode[] = [];
    node.children.forEach((child, at) => {
      const next = at === index ? visit(child, tail) : child;
      if (next) children.push(next);
    });
    return { ...node, children };
  };
  return (visit(root, path) as FilterGroup | null) ?? emptyFilter(root.op);
}

function appendTo(root: FilterGroup, groupPath: FilterPath, child: FilterNode): FilterGroup {
  return updateAt(root, groupPath, (node) =>
    node.type === 'group' ? { ...node, children: [...node.children, child] } : node
  );
}

/** Appends a condition on the first field to the group at `groupPath`. */
export function addCondition(
  root: FilterGroup,
  groupPath: FilterPath,
  fields: readonly FilterField[]
): FilterGroup {
  const field = fields[0];
  return field ? appendTo(root, groupPath, newCondition(field)) : root;
}

/**
 * Appends a nested group (holding one new condition) to the group at
 * `groupPath`, unless its condition would pass `FILTER_LIMITS.depth` (every
 * node counts, so groups nest at most five levels). The nested group
 * starts with the other combinator, the usual reason to nest.
 */
export function addGroup(
  root: FilterGroup,
  groupPath: FilterPath,
  fields: readonly FilterField[]
): FilterGroup {
  const parent = nodeAt(root, groupPath);
  const field = fields[0];
  // The new group and its condition sit one and two levels below the parent.
  if (parent?.type !== 'group' || !field || depthOf(groupPath) + 2 > FILTER_LIMITS.depth) {
    return root;
  }
  return appendTo(root, groupPath, {
    type: 'group',
    op: parent.op === 'and' ? 'or' : 'and',
    children: [newCondition(field)],
  });
}

/** Removes the node at `path` (removing the root clears it). */
export function removeAt(root: FilterGroup, path: FilterPath): FilterGroup {
  return path.length === 0 ? emptyFilter(root.op) : updateAt(root, path, () => null);
}

/** Sets the and/or combinator of the group at `groupPath`. */
export function setCombinator(
  root: FilterGroup,
  groupPath: FilterPath,
  op: FilterGroup['op']
): FilterGroup {
  return updateAt(root, groupPath, (node) => (node.type === 'group' ? { ...node, op } : node));
}

/**
 * Points the condition at `path` to another field. The operator stays when
 * the new field's type allows it (else its first operator), and the value
 * resets when the type changes.
 */
export function changeField(root: FilterGroup, path: FilterPath, field: FilterField): FilterGroup {
  return updateAt(root, path, (node) => {
    if (node.type !== 'condition') return node;
    const operators = operatorsFor(field);
    const operator = operators.includes(node.operator)
      ? node.operator
      : (operators[0] as FilterOperator);
    return withValue({ ...node, field: field.key, operator }, defaultValue(operator, field));
  });
}

const shape = (operator: FilterOperator) =>
  operator === 'in' || operator === 'between'
    ? operator
    : operator === 'isEmpty' || operator === 'isNotEmpty'
      ? 'none'
      : 'one';

/** Changes the operator at `path`, keeping the value when its shape still fits. */
export function changeOperator(
  root: FilterGroup,
  path: FilterPath,
  operator: FilterOperator,
  field: FilterField
): FilterGroup {
  return updateAt(root, path, (node) => {
    if (node.type !== 'condition') return node;
    const keep = shape(node.operator) === shape(operator);
    return withValue({ ...node, operator }, keep ? node.value : defaultValue(operator, field));
  });
}

/** Sets the value of the condition at `path` (`undefined` clears it). */
export function changeValue(root: FilterGroup, path: FilterPath, value: Value): FilterGroup {
  return updateAt(root, path, (node) =>
    node.type === 'condition' ? withValue(node, value) : node
  );
}

/**
 * The runnable part of a model: incomplete conditions removed (and, given
 * `fields`, those with a `filterIssues` problem), then the groups that
 * leaves empty. The root stays, possibly empty.
 */
export function pruneFilter(root: FilterGroup, fields?: readonly FilterField[]): FilterGroup {
  const schema = fields ? filterSchemaFor(fields) : null;
  const runs = (node: FilterCondition) =>
    isComplete(node) && (!schema || schema.safeParse(node).success);
  const visit = (node: FilterNode): FilterNode | null => {
    if (node.type === 'condition') return runs(node) ? node : null;
    const children = node.children.map(visit).filter((child) => child !== null);
    return children.length > 0 ? { ...node, children } : null;
  };
  return (visit(root) as FilterGroup | null) ?? emptyFilter(root.op);
}

/** One problem in a model, with the path of the condition it belongs to. */
export interface FilterIssue {
  path: number[];
  message: string;
}

/**
 * Problems with complete conditions against `fields`: unknown fields,
 * operators that do not fit, and values of the wrong kind (for example an
 * enum value outside its options). Incomplete conditions are not issues.
 */
export function filterIssues(root: FilterGroup, fields: readonly FilterField[]): FilterIssue[] {
  const schema = filterSchemaFor(fields);
  const issues: FilterIssue[] = [];
  const visit = (node: FilterNode, path: number[]) => {
    if (node.type === 'group') {
      node.children.forEach((child, index) => {
        visit(child, [...path, index]);
      });
      return;
    }
    if (!isComplete(node)) return;
    const result = schema.safeParse(node);
    if (!result.success) issues.push({ path, message: result.error.message });
  };
  visit(root, []);
  return issues;
}

/**
 * Reads a saved model (untrusted JSON) and checks it against `fields`;
 * throws a `ValidationError`. A bare condition is wrapped in an `and` group.
 */
export function parseFilter(input: unknown, fields: readonly FilterField[]): FilterGroup {
  const node = filterSchemaFor(fields).parse(input);
  return node.type === 'group' ? node : { type: 'group', op: 'and', children: [node] };
}

function inferType(conditions: FilterCondition[]): GridValueType {
  for (const { operator, value } of conditions) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'number') return 'number';
    if (typeof first === 'boolean') return 'boolean';
    if (operator === 'before' || operator === 'after' || operator === 'between') return 'date';
  }
  return 'text';
}

/** Fields inferred from a model's values (numbers, booleans, dates by `before`/`after`/`between`, else text). */
function fieldsOf(root: FilterGroup): FilterField[] {
  const byKey = new Map<string, FilterCondition[]>();
  const visit = (node: FilterNode) => {
    if (node.type === 'group') node.children.forEach(visit);
    else byKey.set(node.field, [...(byKey.get(node.field) ?? []), node]);
  };
  visit(root);
  return [...byKey].map(([key, conditions]) => ({
    key,
    header: key,
    type: inferType(conditions),
  }));
}

/**
 * The rows a model matches, in their order. Pure: conditions that cannot run
 * (incomplete, or not fitting the fields; see `pruneFilter` and
 * `filterIssues`) are skipped, text compares without case, and an empty
 * model keeps every row. Pass the `fields` (or grid columns) for typed
 * comparison and custom accessors; without them each field reads `row[key]`
 * and its type is inferred from the model's values. A model past
 * `FILTER_LIMITS` throws a `ValidationError`.
 */
export function applyFilter<T>(
  rows: readonly T[],
  model: FilterGroup,
  fields?: readonly FilterField<T>[]
): T[] {
  const columns = (fields ?? fieldsOf(model)) as readonly GridColumnDef<T>[];
  const runnable = pruneFilter(model, columns);
  if (runnable.children.length === 0) return [...rows];
  const test = compileFilter<T>(runnable, columns);
  return rows.filter(test);
}
