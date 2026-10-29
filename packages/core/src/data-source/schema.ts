/**
 * Data-source declarations (ADR-015): the host names each source, types its
 * fields and declares what agents may ask of it. A blueprint can only name a
 * declared source and query declared fields with the operators the field
 * allows; nothing here builds a URL, a query string or code.
 */

/** Field value types. The same five types as the `@texuli/data` grid (`GridValueType`). */
export const SOURCE_FIELD_TYPES = ['text', 'enum', 'number', 'date', 'boolean'] as const;
export type SourceFieldType = (typeof SOURCE_FIELD_TYPES)[number];

/** What a source can do. `search` means `list` also accepts free search text. */
export const SOURCE_OPERATIONS = ['list', 'get', 'create', 'update', 'delete', 'search'] as const;
export type SourceOperation = (typeof SOURCE_OPERATIONS)[number];

/** How `list` pages: by an opaque cursor, by row offset, or not at all (one page). */
export const SOURCE_PAGINATION_STYLES = ['cursor', 'offset', 'none'] as const;
export type SourcePaginationStyle = (typeof SOURCE_PAGINATION_STYLES)[number];

/**
 * Filter operators: exactly the `@texuli/data` grid filter model's
 * `FILTER_OPERATORS`, so a query's filter is the same data the grid and the
 * filter builder store.
 */
export const SOURCE_FILTER_OPERATORS = [
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
export type SourceFilterOperator = (typeof SOURCE_FILTER_OPERATORS)[number];

/** Operators that apply to each field type (the grid's `OPERATORS_BY_TYPE`). */
export const SOURCE_OPERATORS_BY_TYPE: Readonly<
  Record<SourceFieldType, readonly SourceFilterOperator[]>
> = Object.freeze({
  text: Object.freeze(['eq', 'neq', 'contains', 'in', 'isEmpty', 'isNotEmpty'] as const),
  enum: Object.freeze(['eq', 'neq', 'in', 'isEmpty', 'isNotEmpty'] as const),
  number: Object.freeze(['eq', 'neq', 'in', 'between', 'isEmpty', 'isNotEmpty'] as const),
  date: Object.freeze([
    'eq',
    'neq',
    'between',
    'before',
    'after',
    'isEmpty',
    'isNotEmpty',
  ] as const),
  boolean: Object.freeze(['eq', 'neq', 'isEmpty', 'isNotEmpty'] as const),
});

/** Every bound of the data-source vocabulary. Strings count UTF-16 units. */
export const SOURCE_LIMITS = Object.freeze({
  /** Sources one registry holds. */
  sources: 256,
  /** Fields one source declares. */
  fields: 64,
  /** Options of an enum field. */
  enumOptions: 100,
  /** Fields one query may project. */
  projection: 32,
  /** Sort keys one query may carry. */
  sort: 4,
  /** Free search text. */
  searchLength: 200,
  /** Filter tree depth and node count (inside the grid model's 6 levels and 200 nodes). */
  filterDepth: 6,
  filterNodes: 64,
  /** Values of an `in` list (the grid's limit). */
  filterValues: 100,
  /** A text value in a filter (the grid's limit). */
  valueLength: 500,
  /** The largest page any source may declare. */
  pageSize: 500,
  /** An opaque pagination cursor. */
  cursorLength: 512,
  /** Fields one create or update may change. */
  changes: 64,
});

/** A source name: lowercase words joined by `.`, `_` or `-`, at most 64 characters. */
export const SOURCE_NAME_PATTERN = '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$';
/** A field name: a letter, then letters, digits or `_`, at most 64 characters. */
export const SOURCE_FIELD_PATTERN = '^[A-Za-z][A-Za-z0-9_]*$';

const NAME_RE = new RegExp(SOURCE_NAME_PATTERN);
const FIELD_RE = new RegExp(SOURCE_FIELD_PATTERN);

/** Whether `value` is a well-formed source name. */
export function isSourceName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && NAME_RE.test(value);
}

/** Whether `value` is a well-formed field name. */
export function isSourceFieldName(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && FIELD_RE.test(value);
}

/** One field as the host declares it. */
export interface SourceFieldDeclaration {
  name: string;
  type: SourceFieldType;
  /** The closed values of an `enum` field. */
  options?: readonly string[];
  /**
   * Filtering: `true` allows every operator of the type, a list allows only
   * those, omitted or `false` allows none.
   */
  filter?: boolean | readonly SourceFilterOperator[];
  /** Whether queries may sort by this field. Default `false`. */
  sort?: boolean;
  /** Whether create and update may set this field. Default `false`. The key never is. */
  editable?: boolean;
  /** Whether create needs a value for this field. Default `false`. */
  required?: boolean;
}

/** A source's schema as the host declares it. */
export interface SourceSchemaDeclaration {
  /** The field that identifies a row (text or number). Default `id`. */
  key?: string;
  fields: readonly SourceFieldDeclaration[];
  operations: readonly SourceOperation[];
  /** Default `none`. */
  pagination?: SourcePaginationStyle;
  /** The largest page a query may ask for, at most {@link SOURCE_LIMITS.pageSize}. Default 100. */
  maxPageSize?: number;
  /** The page size when a query names none. Default the smaller of 25 and `maxPageSize`. */
  defaultPageSize?: number;
}

/** One field, normalized: every flag explicit, operators resolved. */
export interface SourceFieldDescriptor {
  readonly name: string;
  readonly type: SourceFieldType;
  readonly options?: readonly string[];
  readonly filter: readonly SourceFilterOperator[];
  readonly sort: boolean;
  readonly editable: boolean;
  readonly required: boolean;
}

/**
 * A source as plain JSON data: what validators (`@texuli/catalog`,
 * `@texuli/spec`) and agents read. Never carries the adapter.
 */
export interface SourceDescriptor {
  readonly name: string;
  readonly key: string;
  readonly fields: readonly SourceFieldDescriptor[];
  readonly operations: readonly SourceOperation[];
  readonly pagination: SourcePaginationStyle;
  readonly maxPageSize: number;
  readonly defaultPageSize: number;
}

/** A thrown declaration mistake: the host's code, never agent data, gets this. */
function declarationError(name: string, message: string): TypeError {
  return new TypeError(`Data source "${name}": ${message}`);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Check a host declaration and return its frozen descriptor. Throws a
 * `TypeError` for a declaration mistake (an unknown type, a duplicate
 * field, an operator the type does not take, a page size over the cap).
 */
export function describeSource(
  name: string,
  declaration: SourceSchemaDeclaration
): SourceDescriptor {
  if (!isSourceName(name)) throw declarationError(String(name), 'the name is not a source name.');
  const fields: readonly SourceFieldDeclaration[] = Array.isArray(declaration.fields)
    ? declaration.fields
    : [];
  if (fields.length === 0 || fields.length > SOURCE_LIMITS.fields) {
    throw declarationError(name, `declare 1 to ${SOURCE_LIMITS.fields} fields.`);
  }
  const seen = new Set<string>();
  const out: SourceFieldDescriptor[] = [];
  for (const field of fields) {
    if (!isSourceFieldName(field?.name)) throw declarationError(name, 'a field name is malformed.');
    if (seen.has(field.name)) throw declarationError(name, `"${field.name}" is declared twice.`);
    seen.add(field.name);
    if (!(SOURCE_FIELD_TYPES as readonly unknown[]).includes(field.type)) {
      throw declarationError(name, `"${field.name}" has an unknown type.`);
    }
    const allowed = SOURCE_OPERATORS_BY_TYPE[field.type];
    let filter: readonly SourceFilterOperator[] = [];
    if (field.filter === true) filter = allowed;
    else if (Array.isArray(field.filter)) {
      const declared = field.filter as readonly SourceFilterOperator[];
      for (const op of declared) {
        if (!allowed.includes(op)) {
          throw declarationError(name, `"${field.name}" (${field.type}) cannot filter by "${op}".`);
        }
      }
      filter = Object.freeze([...new Set(declared)]);
    }
    let options: readonly string[] | undefined;
    if (field.type === 'enum') {
      const declared: readonly unknown[] = Array.isArray(field.options) ? field.options : [];
      if (
        declared.length === 0 ||
        declared.length > SOURCE_LIMITS.enumOptions ||
        declared.some((o) => typeof o !== 'string' || o.length > SOURCE_LIMITS.valueLength)
      ) {
        throw declarationError(name, `"${field.name}" needs 1 to 100 string options.`);
      }
      options = Object.freeze([...(declared as readonly string[])]);
    } else if (field.options !== undefined) {
      throw declarationError(name, `"${field.name}" is not an enum and takes no options.`);
    }
    out.push(
      Object.freeze({
        name: field.name,
        type: field.type,
        ...(options ? { options } : {}),
        filter,
        sort: field.sort === true,
        editable: field.editable === true,
        required: field.required === true,
      })
    );
  }
  const key = declaration.key ?? 'id';
  const keyField = out.find((field) => field.name === key);
  if (!keyField) throw declarationError(name, `the key "${key}" is not a declared field.`);
  if (keyField.type !== 'text' && keyField.type !== 'number') {
    throw declarationError(name, 'the key must be a text or number field.');
  }
  if (keyField.editable) throw declarationError(name, 'the key cannot be editable.');
  const operations = declaration.operations;
  if (
    !Array.isArray(operations) ||
    operations.some((op) => !(SOURCE_OPERATIONS as readonly unknown[]).includes(op))
  ) {
    throw declarationError(name, 'operations must come from SOURCE_OPERATIONS.');
  }
  const pagination = declaration.pagination ?? 'none';
  if (!(SOURCE_PAGINATION_STYLES as readonly unknown[]).includes(pagination)) {
    throw declarationError(name, 'pagination must be cursor, offset or none.');
  }
  const maxPageSize = declaration.maxPageSize ?? 100;
  if (!isPositiveInteger(maxPageSize) || maxPageSize > SOURCE_LIMITS.pageSize) {
    throw declarationError(name, `maxPageSize must be 1 to ${SOURCE_LIMITS.pageSize}.`);
  }
  const defaultPageSize = declaration.defaultPageSize ?? Math.min(25, maxPageSize);
  if (!isPositiveInteger(defaultPageSize) || defaultPageSize > maxPageSize) {
    throw declarationError(name, 'defaultPageSize must be 1 to maxPageSize.');
  }
  return Object.freeze({
    name,
    key,
    fields: Object.freeze(out),
    operations: Object.freeze(SOURCE_OPERATIONS.filter((op) => operations.includes(op))),
    pagination,
    maxPageSize,
    defaultPageSize,
  });
}

/** The descriptor's field named `name`, by own lookup (never the prototype chain). */
export function sourceField(
  descriptor: SourceDescriptor,
  name: string
): SourceFieldDescriptor | undefined {
  for (const field of descriptor.fields) if (field.name === name) return field;
  return undefined;
}
