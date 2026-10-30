/**
 * The closed query model (ADR-015): projection, a filter tree in the
 * `@texuli/data` grid filter model's shape, sort keys, search text and a
 * page size. `checkSourceQuery` validates untrusted input against a source
 * descriptor without recursion past the depth cap and in time linear in the
 * input; the adapter receives the validated copy, never the input.
 */

import {
  isSourceFieldName,
  SOURCE_FILTER_OPERATORS,
  SOURCE_LIMITS,
  type SourceDescriptor,
  type SourceFieldDescriptor,
  type SourceFilterOperator,
  sourceField,
} from './schema.ts';

/** A value a row field or a filter holds. */
export type SourceValue = string | number | boolean | null;

/** One filter condition (the grid model's `FilterCondition`). */
export interface SourceFilterCondition {
  readonly type: 'condition';
  readonly field: string;
  readonly operator: SourceFilterOperator;
  /** eq/neq: a scalar; contains: text; in: a list; between: [low, high]; before/after: a date. */
  readonly value?: SourceValue | readonly SourceValue[];
}

/** An and/or group (the grid model's `FilterGroup`). */
export interface SourceFilterGroup {
  readonly type: 'group';
  readonly op: 'and' | 'or';
  readonly children: readonly SourceFilterNode[];
}

export type SourceFilterNode = SourceFilterCondition | SourceFilterGroup;

export interface SourceSort {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

/** A validated query. Every member is optional. */
export interface SourceQuery {
  /** Fields to return; the key always comes back. Omitted: every field. */
  readonly fields?: readonly string[];
  readonly filter?: SourceFilterNode;
  readonly sort?: readonly SourceSort[];
  /** Free text for a source that declares `search`. Passed to the adapter as data. */
  readonly search?: string;
  /** Rows per page, at most the source's `maxPageSize`. Omitted: its `defaultPageSize`. */
  readonly pageSize?: number;
}

/** The query members, in canonical order. Anything else is refused. */
export const SOURCE_QUERY_KEYS = ['fields', 'filter', 'sort', 'search', 'pageSize'] as const;

export type SourceQueryIssueCode =
  | 'shape'
  | 'limit'
  | 'unknown-field'
  | 'operator'
  | 'value'
  | 'sort'
  | 'search'
  | 'page-size'
  | 'operation';

export interface SourceQueryIssue {
  readonly code: SourceQueryIssueCode;
  /** A JSON path into the query (`$.filter.children[0].value`). */
  readonly path: string;
  readonly message: string;
}

export type SourceQueryCheck =
  | { readonly ok: true; readonly query: SourceQuery }
  | { readonly ok: false; readonly issues: readonly SourceQueryIssue[] };

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Whether `value` is a date: an ISO 8601 date or date-time string, or epoch milliseconds. */
export function isSourceDate(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return (
    typeof value === 'string' &&
    value.length <= 35 &&
    DATE_RE.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

/** Whether `value` is a legal value of `field` (`null` is always legal: no value). */
export function fitsSourceField(field: SourceFieldDescriptor, value: unknown): boolean {
  if (value === null) return true;
  switch (field.type) {
    case 'text':
      return typeof value === 'string';
    case 'enum':
      return typeof value === 'string' && (field.options ?? []).includes(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'date':
      return isSourceDate(value);
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return false;
  }
}

function isScalar(value: unknown): value is SourceValue {
  return (
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.length <= SOURCE_LIMITS.valueLength)
  );
}

/**
 * Whether the input filter is over the depth or node caps, measured without
 * recursion so a tree nested thousands of levels deep is refused before
 * anything recurses into it. Stops at the first excess.
 */
function filterOverLimits(input: unknown): boolean {
  const stack: { node: unknown; depth: number }[] = [{ node: input, depth: 1 }];
  let nodes = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: unknown; depth: number };
    nodes += 1;
    if (depth > SOURCE_LIMITS.filterDepth || nodes > SOURCE_LIMITS.filterNodes) return true;
    const children = isBag(node) ? node.children : undefined;
    if (!Array.isArray(children)) continue;
    if (nodes + stack.length + children.length > SOURCE_LIMITS.filterNodes) return true;
    for (const child of children) stack.push({ node: child, depth: depth + 1 });
  }
  return false;
}

interface Checker {
  readonly descriptor: SourceDescriptor;
  readonly issues: SourceQueryIssue[];
}

function report(checker: Checker, code: SourceQueryIssueCode, path: string, message: string): void {
  // One bad query can say a lot; the first 32 issues are enough to fix it.
  if (checker.issues.length < 32) checker.issues.push(Object.freeze({ code, path, message }));
}

/** An object with exactly the allowed own keys (a JSON `__proto__` key is an own key, and refused). */
function closedKeys(
  checker: Checker,
  value: Bag,
  allowed: readonly string[],
  path: string
): boolean {
  let ok = true;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      report(checker, 'shape', `${path}.${key}`, `"${key}" is not part of a query here.`);
      ok = false;
    }
  }
  return ok;
}

function knownField(
  checker: Checker,
  name: unknown,
  path: string
): SourceFieldDescriptor | undefined {
  if (!isSourceFieldName(name)) {
    report(checker, 'shape', path, 'A field is named by a field name.');
    return undefined;
  }
  const field = sourceField(checker.descriptor, name);
  if (!field) {
    report(checker, 'unknown-field', path, `"${checker.descriptor.name}" has no "${name}" field.`);
  }
  return field;
}

function checkCondition(checker: Checker, input: Bag, path: string): SourceFilterCondition | null {
  if (!closedKeys(checker, input, ['type', 'field', 'operator', 'value'], path)) return null;
  const field = knownField(checker, input.field, `${path}.field`);
  const operator = input.operator;
  if (!(SOURCE_FILTER_OPERATORS as readonly unknown[]).includes(operator)) {
    report(checker, 'operator', `${path}.operator`, 'The operator is not a filter operator.');
    return null;
  }
  if (!field) return null;
  const op = operator as SourceFilterOperator;
  if (!field.filter.includes(op)) {
    report(
      checker,
      'operator',
      `${path}.operator`,
      `"${field.name}" cannot be filtered by "${op}".`
    );
    return null;
  }
  const here = `${path}.value`;
  const has = Object.hasOwn(input, 'value');
  const value = input.value;
  const fail = (message: string): null => {
    report(checker, 'value', here, message);
    return null;
  };
  // A list value is checked item by item against the field's type.
  const fitsAll = (list: readonly unknown[]) =>
    list.every((item) => isScalar(item) && fitsSourceField(field, item));
  if (op === 'isEmpty' || op === 'isNotEmpty') {
    if (has) return fail(`${op} takes no value.`);
    return Object.freeze({ type: 'condition', field: field.name, operator: op });
  }
  if (op === 'in') {
    if (!Array.isArray(value) || value.length === 0 || value.length > SOURCE_LIMITS.filterValues) {
      return fail(`in needs a list of 1 to ${SOURCE_LIMITS.filterValues} values.`);
    }
    if (!fitsAll(value)) return fail(`Every value must fit "${field.name}" (${field.type}).`);
    return Object.freeze({
      type: 'condition',
      field: field.name,
      operator: op,
      value: Object.freeze([...value] as SourceValue[]),
    });
  }
  if (op === 'between') {
    if (!Array.isArray(value) || value.length !== 2 || value.includes(null) || !fitsAll(value)) {
      return fail(`between needs [low, high] values of "${field.name}" (${field.type}).`);
    }
    return Object.freeze({
      type: 'condition',
      field: field.name,
      operator: op,
      value: Object.freeze([...value] as SourceValue[]),
    });
  }
  if (op === 'contains' && (typeof value !== 'string' || value === '')) {
    return fail('contains needs text.');
  }
  if ((op === 'before' || op === 'after') && !isSourceDate(value)) {
    return fail(`${op} needs a date.`);
  }
  if (!has || !isScalar(value) || !fitsSourceField(field, value)) {
    return fail(`${op} needs one value of "${field.name}" (${field.type}).`);
  }
  return Object.freeze({ type: 'condition', field: field.name, operator: op, value });
}

/** Recursion is safe here: `filterOverLimits` capped the depth at 6 first. */
function checkFilter(checker: Checker, input: unknown, path: string): SourceFilterNode | null {
  if (!isBag(input)) {
    report(checker, 'shape', path, 'A filter node is an object.');
    return null;
  }
  if (input.type === 'group') {
    if (!closedKeys(checker, input, ['type', 'op', 'children'], path)) return null;
    if (input.op !== 'and' && input.op !== 'or') {
      report(checker, 'shape', `${path}.op`, 'A group is "and" or "or".');
      return null;
    }
    if (!Array.isArray(input.children) || input.children.length === 0) {
      report(checker, 'shape', `${path}.children`, 'A group needs at least one child.');
      return null;
    }
    const children: SourceFilterNode[] = [];
    input.children.forEach((child, index) => {
      const checked = checkFilter(checker, child, `${path}.children[${index}]`);
      if (checked) children.push(checked);
    });
    if (children.length !== input.children.length) return null;
    return Object.freeze({ type: 'group', op: input.op, children: Object.freeze(children) });
  }
  if (input.type !== 'condition') {
    report(checker, 'shape', `${path}.type`, 'A filter node is a "condition" or a "group".');
    return null;
  }
  return checkCondition(checker, input, path);
}

function checkFields(checker: Checker, input: unknown): readonly string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > SOURCE_LIMITS.projection) {
    report(
      checker,
      'shape',
      '$.fields',
      `fields lists 1 to ${SOURCE_LIMITS.projection} field names.`
    );
    return null;
  }
  const out: string[] = [];
  input.forEach((name, index) => {
    const field = knownField(checker, name, `$.fields[${index}]`);
    if (field && !out.includes(field.name)) out.push(field.name);
  });
  // A repeated name is dropped; an unknown one was reported and fails the query.
  return Object.freeze(out);
}

function checkSort(checker: Checker, input: unknown): readonly SourceSort[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > SOURCE_LIMITS.sort) {
    report(checker, 'shape', '$.sort', `sort lists 1 to ${SOURCE_LIMITS.sort} keys.`);
    return null;
  }
  const out: SourceSort[] = [];
  input.forEach((entry, index) => {
    const path = `$.sort[${index}]`;
    if (!isBag(entry) || !closedKeys(checker, entry, ['field', 'direction'], path)) {
      if (!isBag(entry)) report(checker, 'shape', path, 'A sort key is an object.');
      return;
    }
    const direction = entry.direction ?? 'asc';
    if (direction !== 'asc' && direction !== 'desc') {
      report(checker, 'shape', `${path}.direction`, 'direction is "asc" or "desc".');
      return;
    }
    const field = knownField(checker, entry.field, `${path}.field`);
    if (!field) return;
    if (!field.sort) {
      report(checker, 'sort', `${path}.field`, `"${field.name}" is not sortable.`);
      return;
    }
    if (out.some((sort) => sort.field === field.name)) {
      report(checker, 'sort', `${path}.field`, `"${field.name}" is sorted twice.`);
      return;
    }
    out.push(Object.freeze({ field: field.name, direction }));
  });
  return Object.freeze(out);
}

/**
 * Validate an untrusted query against a source. On success the query is a
 * frozen copy holding only checked members; on failure every issue (up to
 * 32) has a code and a path. Strings are data: they reach the adapter as
 * they came, and nothing here concatenates them into anything.
 */
export function checkSourceQuery(descriptor: SourceDescriptor, input: unknown): SourceQueryCheck {
  const checker: Checker = { descriptor, issues: [] };
  const lists = descriptor.operations.includes('list') || descriptor.operations.includes('search');
  if (!lists) {
    report(checker, 'operation', '$', `"${descriptor.name}" cannot list rows.`);
    return { ok: false, issues: checker.issues };
  }
  if (input === undefined) return { ok: true, query: Object.freeze({}) };
  if (!isBag(input)) {
    report(checker, 'shape', '$', 'A query is an object.');
    return { ok: false, issues: checker.issues };
  }
  closedKeys(checker, input, SOURCE_QUERY_KEYS, '$');
  const query: {
    fields?: readonly string[];
    filter?: SourceFilterNode;
    sort?: readonly SourceSort[];
    search?: string;
    pageSize?: number;
  } = {};
  if (Object.hasOwn(input, 'fields')) {
    const fields = checkFields(checker, input.fields);
    if (fields) query.fields = fields;
  }
  if (Object.hasOwn(input, 'filter')) {
    if (filterOverLimits(input.filter)) {
      report(
        checker,
        'limit',
        '$.filter',
        `A filter has at most ${SOURCE_LIMITS.filterDepth} levels and ${SOURCE_LIMITS.filterNodes} nodes.`
      );
    } else {
      const filter = checkFilter(checker, input.filter, '$.filter');
      if (filter) query.filter = filter;
    }
  }
  if (Object.hasOwn(input, 'sort')) {
    const sort = checkSort(checker, input.sort);
    if (sort) query.sort = sort;
  }
  if (Object.hasOwn(input, 'search')) {
    const search = input.search;
    if (!descriptor.operations.includes('search')) {
      report(checker, 'search', '$.search', `"${descriptor.name}" does not search.`);
    } else if (typeof search !== 'string' || search.length > SOURCE_LIMITS.searchLength) {
      report(
        checker,
        'shape',
        '$.search',
        `search is text of at most ${SOURCE_LIMITS.searchLength} characters.`
      );
    } else if (search !== '') {
      query.search = search;
    }
  }
  if (Object.hasOwn(input, 'pageSize')) {
    const size = input.pageSize;
    if (typeof size !== 'number' || !Number.isInteger(size) || size < 1) {
      report(checker, 'page-size', '$.pageSize', 'pageSize is a positive integer.');
    } else if (size > descriptor.maxPageSize) {
      report(
        checker,
        'page-size',
        '$.pageSize',
        `"${descriptor.name}" pages at most ${descriptor.maxPageSize} rows.`
      );
    } else {
      query.pageSize = size;
    }
  }
  if (checker.issues.length > 0) return { ok: false, issues: checker.issues };
  return { ok: true, query: Object.freeze(query) };
}

/**
 * Canonical JSON of plain data: object keys sorted at every depth, arrays in
 * order. Two equal queries give the same string, whatever their key order.
 * Only call it on validated data (the depth is already bounded).
 */
export function stableJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const keys = Object.keys(value as Bag)
    .filter((key) => (value as Bag)[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson((value as Bag)[key])}`).join(',')}}`;
}

/** The cache and deduplication key of one page of one validated query. */
export function sourceQueryKey(
  source: string,
  query: SourceQuery,
  page: { readonly cursor?: string | null; readonly offset?: number | null } = {}
): string {
  const projection = query.fields ? [...query.fields].sort() : undefined;
  return stableJson({
    source,
    query: { ...query, ...(projection ? { fields: projection } : {}) },
    cursor: page.cursor ?? null,
    offset: page.offset ?? null,
  });
}
