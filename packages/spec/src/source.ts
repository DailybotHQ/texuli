/**
 * Data-source bindings (spec 0.8.0, ADR-012 and ADR-015): a sourceable prop
 * reads rows from a source the host registered,
 * `{"$source": name, "query": {...}, "map": {...}}`. The schema
 * (`$defs.sourceBinding`) fixes the closed shape; this module checks a
 * binding against the host's source descriptors: the name, every field,
 * operator and value of the query, the page size and the map. It mirrors
 * `checkSourceQuery` in `@texuli/core/data-source` (the spec cannot import
 * core: both are L0), and a parity test keeps the two in agreement.
 * With no descriptors a binding is refused: the spec fails closed.
 */

import { isRecord } from './dialect.ts';

/** The binding key that reads a host data source: `{ "$source": name, … }`. */
export const SOURCE_BINDING_KEY = '$source';

/** The members a binding takes besides `$source`. */
export const SOURCE_BINDING_FIELDS = ['query', 'map'] as const;

export const SPEC_SOURCE_FIELD_TYPES = ['text', 'enum', 'number', 'date', 'boolean'] as const;
export type SpecSourceFieldType = (typeof SPEC_SOURCE_FIELD_TYPES)[number];

export const SPEC_SOURCE_OPERATIONS = [
  'list',
  'get',
  'create',
  'update',
  'delete',
  'search',
] as const;
export type SpecSourceOperation = (typeof SPEC_SOURCE_OPERATIONS)[number];

/** The `@texuli/data` grid filter model's operators (`$defs.sourceFilter.operator`). */
export const SPEC_SOURCE_FILTER_OPERATORS = [
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
export type SpecSourceFilterOperator = (typeof SPEC_SOURCE_FILTER_OPERATORS)[number];

/** Every bound of a binding; the schema writes the static ones too (`tests/source.test.ts`). */
export const SPEC_SOURCE_LIMITS = Object.freeze({
  nameLength: 64,
  projection: 32,
  sort: 4,
  searchLength: 200,
  filterDepth: 6,
  filterNodes: 64,
  filterValues: 100,
  valueLength: 500,
  pageSize: 500,
  mapEntries: 16,
});

export const SPEC_SOURCE_PATTERNS = Object.freeze({
  sourceName: '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$',
  sourceFieldName: '^[A-Za-z][A-Za-z0-9_]*$',
});

const FIELD_RE = new RegExp(SPEC_SOURCE_PATTERNS.sourceFieldName, 'u');
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** One declared field, as `@texuli/core/data-source` describes it. */
export interface SpecSourceField {
  readonly name: string;
  readonly type: SpecSourceFieldType;
  readonly options?: readonly string[];
  readonly filter: readonly SpecSourceFilterOperator[];
  readonly sort: boolean;
  readonly editable?: boolean;
  readonly required?: boolean;
}

/**
 * A host source as plain data: structurally the `SourceDescriptor` of
 * `@texuli/core/data-source` (`registry.describe()` can be passed as is).
 */
export interface SpecSourceDescriptor {
  readonly name: string;
  readonly key: string;
  readonly fields: readonly SpecSourceField[];
  readonly operations: readonly SpecSourceOperation[];
  readonly pagination?: 'cursor' | 'offset' | 'none';
  readonly maxPageSize: number;
  readonly defaultPageSize?: number;
}

/** One semantic problem with a binding; `at` is relative to the binding (`.query.filter`). */
export interface SourceBindingIssue {
  readonly code: 'source' | 'unknown-source';
  readonly at: string;
  readonly message: string;
}

/** What a binding is checked against. */
export interface SourceBindingContext {
  /** The host's sources. Omitted: every binding is refused (fail closed). */
  readonly sources?: readonly SpecSourceDescriptor[];
  /**
   * The item fields the bound prop's rows may carry (its item schema's
   * properties), when known: `map` keys must be among them.
   */
  readonly itemFields?: readonly string[];
}

/** Whether a value is shaped like a source binding (`$source` as an own key). */
export function isSourceBinding(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.hasOwn(value, SOURCE_BINDING_KEY);
}

/** Whether `value` is an ISO 8601 date or date-time, or epoch milliseconds. */
export function isSpecSourceDate(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return (
    typeof value === 'string' &&
    value.length <= 35 &&
    DATE_RE.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function fits(field: SpecSourceField, value: unknown): boolean {
  if (value === null) return true;
  switch (field.type) {
    case 'text':
      return typeof value === 'string' && value.length <= SPEC_SOURCE_LIMITS.valueLength;
    case 'enum':
      return typeof value === 'string' && (field.options ?? []).includes(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'date':
      return isSpecSourceDate(value);
    case 'boolean':
      return typeof value === 'boolean';
    default:
      return false;
  }
}

/** The descriptor's field by name, without touching the prototype chain. */
function fieldOf(source: SpecSourceDescriptor, name: unknown): SpecSourceField | undefined {
  if (typeof name !== 'string') return undefined;
  return source.fields.find((field) => field.name === name);
}

/** Over the filter's depth or node caps, measured without recursion. */
function filterOverLimits(input: unknown): boolean {
  const stack: { node: unknown; depth: number }[] = [{ node: input, depth: 1 }];
  let nodes = 0;
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: unknown; depth: number };
    nodes += 1;
    if (depth > SPEC_SOURCE_LIMITS.filterDepth || nodes > SPEC_SOURCE_LIMITS.filterNodes) {
      return true;
    }
    const children = isRecord(node) ? node.children : undefined;
    if (!Array.isArray(children)) continue;
    if (nodes + stack.length + children.length > SPEC_SOURCE_LIMITS.filterNodes) return true;
    for (const child of children) stack.push({ node: child, depth: depth + 1 });
  }
  return false;
}

const NAME_RE = new RegExp(SPEC_SOURCE_PATTERNS.sourceName, 'u');
const QUERY_KEYS = ['fields', 'filter', 'sort', 'search', 'pageSize'];

function isFieldName(value: unknown): boolean {
  return typeof value === 'string' && value.length <= 64 && FIELD_RE.test(value);
}

/**
 * The closed shape of `$defs.sourceBinding`, checked without the schema
 * document (so `@texuli/catalog` can run it alone): the members, their
 * types and the static limits. The filter's own members are judged with
 * its meaning, below.
 */
function shapeProblem(binding: Record<string, unknown>): { at: string; message: string } | null {
  const extra = Object.keys(binding).find(
    (key) => key !== SOURCE_BINDING_KEY && key !== 'query' && key !== 'map'
  );
  if (extra !== undefined)
    return { at: `.${extra}`, message: `A data-source binding takes no "${extra}".` };
  const name = binding[SOURCE_BINDING_KEY];
  if (
    typeof name !== 'string' ||
    name.length > SPEC_SOURCE_LIMITS.nameLength ||
    !NAME_RE.test(name)
  ) {
    return {
      at: `.${SOURCE_BINDING_KEY}`,
      message: 'A source is named by a source name, never a URL.',
    };
  }
  if (Object.hasOwn(binding, 'map')) {
    const map = binding.map;
    if (!isRecord(map) || Object.values(map).some((value) => !isFieldName(value))) {
      return { at: '.map', message: 'map pairs item fields with source field names.' };
    }
  }
  if (!Object.hasOwn(binding, 'query')) return null;
  const query = binding.query;
  if (!isRecord(query)) return { at: '.query', message: 'A query is an object.' };
  const unknown = Object.keys(query).find((key) => !QUERY_KEYS.includes(key));
  if (unknown !== undefined)
    return { at: `.query.${unknown}`, message: `A query takes no "${unknown}".` };
  const { fields, sort, search, pageSize } = query;
  if (
    fields !== undefined &&
    (!Array.isArray(fields) ||
      fields.length === 0 ||
      fields.length > SPEC_SOURCE_LIMITS.projection ||
      !fields.every(isFieldName))
  ) {
    return {
      at: '.query.fields',
      message: `fields lists 1 to ${SPEC_SOURCE_LIMITS.projection} field names.`,
    };
  }
  if (sort !== undefined) {
    const keyOk = (entry: unknown) =>
      isRecord(entry) &&
      Object.keys(entry).every((key) => key === 'field' || key === 'direction') &&
      isFieldName(entry.field) &&
      (entry.direction === undefined || entry.direction === 'asc' || entry.direction === 'desc');
    if (
      !Array.isArray(sort) ||
      sort.length === 0 ||
      sort.length > SPEC_SOURCE_LIMITS.sort ||
      !sort.every(keyOk)
    ) {
      return { at: '.query.sort', message: `sort lists 1 to ${SPEC_SOURCE_LIMITS.sort} keys.` };
    }
  }
  if (
    search !== undefined &&
    (typeof search !== 'string' || search.length > SPEC_SOURCE_LIMITS.searchLength)
  ) {
    return {
      at: '.query.search',
      message: `search is text of at most ${SPEC_SOURCE_LIMITS.searchLength} characters.`,
    };
  }
  if (
    pageSize !== undefined &&
    (typeof pageSize !== 'number' ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > SPEC_SOURCE_LIMITS.pageSize)
  ) {
    return {
      at: '.query.pageSize',
      message: `pageSize is an integer from 1 to ${SPEC_SOURCE_LIMITS.pageSize}.`,
    };
  }
  return null;
}

/**
 * Check a binding: its closed shape, then its meaning against the host's
 * sources (fail closed without them): the name, every field, operator and
 * value of the query, the page size and the map. One issue per problem, up
 * to 16. `@texuli/spec`'s validator runs the schema (`$defs.sourceBinding`)
 * first; `@texuli/catalog` runs this alone.
 */
export function checkSourceBinding(
  binding: Record<string, unknown>,
  context: SourceBindingContext
): SourceBindingIssue[] {
  const issues: SourceBindingIssue[] = [];
  const fail = (at: string, message: string, code: SourceBindingIssue['code'] = 'source') => {
    if (issues.length < 16) issues.push({ code, at, message });
  };
  const shape = shapeProblem(binding);
  if (shape) {
    fail(shape.at, shape.message);
    return issues;
  }
  const name = binding[SOURCE_BINDING_KEY];
  if (!context.sources) {
    fail(
      `.${SOURCE_BINDING_KEY}`,
      'No data sources were supplied, so a data-source binding is refused.'
    );
    return issues;
  }
  const source =
    typeof name === 'string' ? context.sources.find((entry) => entry.name === name) : undefined;
  if (!source) {
    fail(
      `.${SOURCE_BINDING_KEY}`,
      `The host registered no source "${String(name)}".`,
      'unknown-source'
    );
    return issues;
  }
  const lists = source.operations.includes('list') || source.operations.includes('search');
  if (!lists) fail(`.${SOURCE_BINDING_KEY}`, `"${source.name}" cannot list rows.`);
  const query = isRecord(binding.query) ? binding.query : {};
  const known = (value: unknown, at: string): SpecSourceField | undefined => {
    const field = fieldOf(source, value);
    if (!field) fail(at, `"${source.name}" has no "${String(value)}" field.`);
    return field;
  };
  if (Array.isArray(query.fields)) {
    query.fields.forEach((entry, index) => {
      known(entry, `.query.fields[${index}]`);
    });
  }
  if (Array.isArray(query.sort)) {
    const seen = new Set<string>();
    query.sort.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      const field = known(entry.field, `.query.sort[${index}].field`);
      if (!field) return;
      if (!field.sort) fail(`.query.sort[${index}].field`, `"${field.name}" is not sortable.`);
      else if (seen.has(field.name))
        fail(`.query.sort[${index}].field`, `"${field.name}" is sorted twice.`);
      seen.add(field.name);
    });
  }
  if (typeof query.search === 'string' && !source.operations.includes('search')) {
    fail('.query.search', `"${source.name}" does not search.`);
  }
  if (typeof query.pageSize === 'number' && query.pageSize > source.maxPageSize) {
    fail('.query.pageSize', `"${source.name}" pages at most ${source.maxPageSize} rows.`);
  }
  if (Object.hasOwn(query, 'filter')) {
    if (filterOverLimits(query.filter)) {
      fail(
        '.query.filter',
        `A filter has at most ${SPEC_SOURCE_LIMITS.filterDepth} levels and ${SPEC_SOURCE_LIMITS.filterNodes} nodes.`
      );
    } else {
      checkFilter(query.filter, '.query.filter', source, fail, known);
    }
  }
  if (isRecord(binding.map)) {
    const entries = Object.entries(binding.map);
    if (entries.length > SPEC_SOURCE_LIMITS.mapEntries) {
      fail('.map', `A map has at most ${SPEC_SOURCE_LIMITS.mapEntries} entries.`);
    }
    for (const [target, from] of entries) {
      if (!FIELD_RE.test(target) || target.length > 64) {
        fail(`.map.${target}`, `"${target}" is not an item field name.`);
      } else if (context.itemFields && !context.itemFields.includes(target)) {
        fail(`.map.${target}`, `The rows of this prop have no "${target}" field.`);
      }
      known(from, `.map.${target}`);
    }
  }
  return issues;
}

/** Recursion is safe here: the depth was capped at 6 first. */
function checkFilter(
  node: unknown,
  at: string,
  source: SpecSourceDescriptor,
  fail: (at: string, message: string) => void,
  known: (value: unknown, at: string) => SpecSourceField | undefined
): void {
  if (!isRecord(node)) {
    fail(at, 'A filter node is an object.');
    return;
  }
  const has = (key: string) => Object.hasOwn(node, key);
  const unknown = Object.keys(node).find(
    (key) => !['type', 'field', 'operator', 'value', 'op', 'children'].includes(key)
  );
  if (unknown !== undefined) {
    fail(`${at}.${unknown}`, `A filter node takes no "${unknown}".`);
    return;
  }
  if (node.type !== 'group' && node.type !== 'condition') {
    fail(`${at}.type`, 'A filter node is a "condition" or a "group".');
    return;
  }
  if (node.type === 'group') {
    const extra = ['field', 'operator', 'value'].find(has);
    if (extra) {
      fail(`${at}.${extra}`, `A group takes no "${extra}".`);
      return;
    }
    if (node.op !== 'and' && node.op !== 'or') {
      fail(`${at}.op`, 'A group is "and" or "or".');
      return;
    }
    if (!Array.isArray(node.children) || node.children.length === 0) {
      fail(`${at}.children`, 'A group needs at least one child.');
      return;
    }
    node.children.forEach((child, index) => {
      checkFilter(child, `${at}.children[${index}]`, source, fail, known);
    });
    return;
  }
  const extra = ['op', 'children'].find(has);
  if (extra) {
    fail(`${at}.${extra}`, `A condition takes no "${extra}".`);
    return;
  }
  const field = known(node.field, `${at}.field`);
  const operator = node.operator;
  if (!(SPEC_SOURCE_FILTER_OPERATORS as readonly unknown[]).includes(operator)) {
    fail(`${at}.operator`, 'A condition needs a filter operator.');
    return;
  }
  if (!field) return;
  const op = operator as SpecSourceFilterOperator;
  if (!field.filter.includes(op)) {
    fail(`${at}.operator`, `"${field.name}" cannot be filtered by "${op}".`);
    return;
  }
  const value = node.value;
  const here = `${at}.value`;
  const scalars = (list: readonly unknown[]) => list.every((item) => fits(field, item));
  if (op === 'isEmpty' || op === 'isNotEmpty') {
    if (has('value')) fail(here, `${op} takes no value.`);
  } else if (op === 'in') {
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      value.length > SPEC_SOURCE_LIMITS.filterValues ||
      !scalars(value)
    ) {
      fail(here, `in needs 1 to ${SPEC_SOURCE_LIMITS.filterValues} values of "${field.name}".`);
    }
  } else if (op === 'between') {
    if (!Array.isArray(value) || value.length !== 2 || value.includes(null) || !scalars(value)) {
      fail(here, `between needs [low, high] values of "${field.name}".`);
    }
  } else if (
    op === 'contains' &&
    (typeof value !== 'string' || value === '' || !fits(field, value))
  ) {
    fail(here, 'contains needs text.');
  } else if ((op === 'before' || op === 'after') && !isSpecSourceDate(value)) {
    fail(here, `${op} needs a date.`);
  } else if (!has('value') || Array.isArray(value) || !fits(field, value)) {
    fail(here, `${op} needs one value of "${field.name}" (${field.type}).`);
  }
}
