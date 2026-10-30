/**
 * The host's source registry: the only place a blueprint's source name
 * resolves. A source is a declaration plus an adapter the host writes; the
 * adapter alone decides how to reach the data (memory, `fetch`, a client
 * SDK). Texuli never builds a URL, SQL or code from a query, and agents
 * never see an adapter, only {@link SourceDescriptor}s.
 */

import type { SourceQuery, SourceValue } from './query.ts';
import {
  describeSource,
  SOURCE_LIMITS,
  type SourceDescriptor,
  type SourceOperation,
  type SourceSchemaDeclaration,
} from './schema.ts';

/** A row's identity: the value of its key field. */
export type SourceRowId = string | number;

/** One row: field name → scalar. */
export type SourceRow = Readonly<Record<string, SourceValue>>;

/** Which page `list` asks for. `cursor` or `offset` follows the source's pagination style. */
export interface SourcePageRequest {
  readonly size: number;
  readonly cursor?: string;
  readonly offset?: number;
}

export interface SourceListRequest {
  /** The validated query (a frozen copy; never the agent's input). */
  readonly query: SourceQuery;
  readonly page: SourcePageRequest;
  readonly signal: AbortSignal;
}

/** What an adapter's `list` resolves to. */
export interface SourcePage<Row = SourceRow> {
  readonly rows: readonly Row[];
  /** `cursor` sources: the next page's cursor, `null` or omitted at the end. */
  readonly nextCursor?: string | null;
  /** `offset` sources: whether rows follow. Default: a full page means maybe. */
  readonly hasMore?: boolean;
  /** The total row count, when the source knows it. */
  readonly total?: number;
}

/**
 * The host's code for one source. Each method backs the operation of the
 * same name (`list` also backs `search`); a missing method for a declared
 * operation is a declaration error. Every request carries an `AbortSignal`.
 */
export interface SourceAdapter<Row = SourceRow> {
  list?(request: SourceListRequest): Promise<SourcePage<Row>>;
  get?(request: { readonly id: SourceRowId; readonly signal: AbortSignal }): Promise<Row | null>;
  create?(request: {
    readonly values: Readonly<Record<string, SourceValue>>;
    readonly signal: AbortSignal;
  }): Promise<Row>;
  update?(request: {
    readonly id: SourceRowId;
    readonly changes: Readonly<Record<string, SourceValue>>;
    readonly signal: AbortSignal;
  }): Promise<Row>;
  delete?(request: { readonly id: SourceRowId; readonly signal: AbortSignal }): Promise<void>;
}

/** A declared source: its descriptor and the host's adapter. */
export interface DataSource {
  readonly descriptor: SourceDescriptor;
  readonly adapter: SourceAdapter;
}

const METHOD: Readonly<Record<SourceOperation, keyof SourceAdapter>> = Object.freeze({
  list: 'list',
  search: 'list',
  get: 'get',
  create: 'create',
  update: 'update',
  delete: 'delete',
});

/**
 * Declare a source. Throws a `TypeError` for a declaration mistake,
 * including a declared operation without its adapter method.
 */
export function defineSource(
  name: string,
  schema: SourceSchemaDeclaration,
  adapter: SourceAdapter
): DataSource {
  const descriptor = describeSource(name, schema);
  for (const op of descriptor.operations) {
    if (typeof adapter?.[METHOD[op]] !== 'function') {
      throw new TypeError(`Data source "${name}": "${op}" needs adapter.${METHOD[op]}().`);
    }
  }
  return Object.freeze({ descriptor, adapter });
}

export interface SourceRegistry {
  has(name: string): boolean;
  get(name: string): DataSource | undefined;
  /** Every registered name, sorted. */
  names(): readonly string[];
  /** One source's descriptor, or every descriptor (sorted by name): what validators and agents read. */
  describe(name: string): SourceDescriptor | undefined;
  describe(): readonly SourceDescriptor[];
  /** Add a source; returns its removal. Throws on a taken name or past 256 sources. */
  register(source: DataSource): () => void;
}

/** A registry seeded with `sources`. Lookups never reach the prototype chain. */
export function createSourceRegistry(sources: readonly DataSource[] = []): SourceRegistry {
  const map = new Map<string, DataSource>();
  const registry: SourceRegistry = {
    has: (name) => typeof name === 'string' && map.has(name),
    get: (name) => (typeof name === 'string' ? map.get(name) : undefined),
    names: () => [...map.keys()].sort(),
    describe: ((name?: string) => {
      if (name !== undefined) return map.get(name)?.descriptor;
      return Object.freeze(
        [...map.values()]
          .map((source) => source.descriptor)
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      );
    }) as SourceRegistry['describe'],
    register(source) {
      const name = source?.descriptor?.name;
      if (typeof name !== 'string') throw new TypeError('Register a source made by defineSource.');
      if (map.has(name)) throw new TypeError(`Data source "${name}" is already registered.`);
      if (map.size >= SOURCE_LIMITS.sources) {
        throw new TypeError(`A registry holds at most ${SOURCE_LIMITS.sources} sources.`);
      }
      map.set(name, source);
      return () => {
        if (map.get(name) === source) map.delete(name);
      };
    },
  };
  for (const source of sources) registry.register(source);
  return Object.freeze(registry);
}
