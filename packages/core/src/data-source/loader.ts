/**
 * The source loader: every read and write a view makes goes through it.
 * It validates the query against the source's declaration, deduplicates
 * identical reads in flight, cancels through `AbortSignal` (the shared
 * request aborts only when every caller has), retries retryable read
 * failures with exponential backoff, caches pages by query key with
 * invalidation, and checks every response before a view sees it. Time
 * comes from an injectable clock, so tests never wait.
 *
 * Methods never throw and never reject: they resolve a `SourceResult`.
 */

import { type SourceError, sourceError, toSourceError } from './errors.ts';
import {
  checkSourceQuery,
  fitsSourceField,
  type SourceQuery,
  type SourceQueryIssue,
  type SourceValue,
  sourceQueryKey,
} from './query.ts';
import type {
  DataSource,
  SourceAdapter,
  SourceRegistry,
  SourceRow,
  SourceRowId,
} from './registry.ts';
import {
  SOURCE_LIMITS,
  type SourceDescriptor,
  type SourceOperation,
  sourceField,
} from './schema.ts';

/** Time for retries, timeouts and cache freshness. Inject a fake one in tests. */
export interface SourceClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** The platform clock (`Date.now` and the global timers), read when called. */
export const SYSTEM_SOURCE_CLOCK: SourceClock = Object.freeze({
  now: () => Date.now(),
  setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle: unknown) =>
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
});

export interface SourceRetryPolicy {
  /** Retries after the first attempt. */
  readonly retries: number;
  /** The first backoff; each retry doubles it. */
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export const DEFAULT_SOURCE_RETRY: SourceRetryPolicy = Object.freeze({
  retries: 2,
  baseDelayMs: 300,
  maxDelayMs: 5000,
});

/** The longest server retry hint the loader honors. */
export const MAX_RETRY_AFTER_MS = 60_000;

export interface SourceLoaderOptions {
  registry: SourceRegistry;
  clock?: SourceClock;
  /** Read retries; `false` disables them. Writes are never retried automatically. */
  retry?: Partial<SourceRetryPolicy> | false;
  /** One attempt's time limit (a retryable `timeout`); `0` disables it. Default 15,000. */
  timeoutMs?: number;
  /** The page cache; `false` disables it. Default 64 entries, fresh for 30 seconds. */
  cache?: { maxEntries?: number; staleMs?: number } | false;
}

export type SourceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SourceError };

/** One loaded page, checked. */
export interface SourceListResult {
  readonly rows: readonly SourceRow[];
  readonly pageSize: number;
  readonly hasMore: boolean;
  /** `cursor` sources: where the next page starts. */
  readonly nextCursor: string | null;
  /** `offset` sources: where the next page starts. */
  readonly nextOffset: number | null;
  readonly total: number | null;
}

export interface SourceCallOptions {
  readonly signal?: AbortSignal;
}

export interface SourceListOptions extends SourceCallOptions {
  /** A `cursor` source's page (from `nextCursor`). */
  readonly cursor?: string | null;
  /** An `offset` source's page (from `nextOffset`). */
  readonly offset?: number | null;
  /** Skip a fresh cache entry and ask the source. */
  readonly fresh?: boolean;
}

export interface SourceMutationOptions extends SourceCallOptions {
  /** Passed to subscribers with the invalidation this write causes, so its own view can skip a reload. */
  readonly origin?: unknown;
}

export interface SourceInvalidation {
  readonly source: string;
  readonly origin?: unknown;
}

export type SourceQueryResolution =
  | { readonly ok: true; readonly query: SourceQuery; readonly descriptor: SourceDescriptor }
  | { readonly ok: false; readonly error: SourceError };

export interface SourceLoader {
  readonly registry: SourceRegistry;
  /** Resolve a source name and validate a query, without loading. */
  checkQuery(name: string, query: unknown): SourceQueryResolution;
  list(
    name: string,
    query: unknown,
    options?: SourceListOptions
  ): Promise<SourceResult<SourceListResult>>;
  /** A fresh cached page, synchronously, or `undefined`. */
  peek(name: string, query: unknown, options?: SourceListOptions): SourceListResult | undefined;
  get(
    name: string,
    id: SourceRowId,
    options?: SourceCallOptions
  ): Promise<SourceResult<SourceRow | null>>;
  create(
    name: string,
    values: unknown,
    options?: SourceMutationOptions
  ): Promise<SourceResult<SourceRow>>;
  update(
    name: string,
    id: SourceRowId,
    changes: unknown,
    options?: SourceMutationOptions
  ): Promise<SourceResult<SourceRow>>;
  remove(
    name: string,
    id: SourceRowId,
    options?: SourceMutationOptions
  ): Promise<SourceResult<null>>;
  /** Drop cached pages of one source (or all) and tell its subscribers. */
  invalidate(name?: string, origin?: unknown): void;
  /** Hear invalidations of one source. Returns the unsubscribe. */
  subscribe(name: string, listener: (event: SourceInvalidation) => void): () => void;
  /** Shared reads in flight. */
  inFlight(): number;
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failure<T>(error: SourceError): SourceResult<T> {
  return Object.freeze({ ok: false, error });
}

function success<T>(value: T): SourceResult<T> {
  return Object.freeze({ ok: true, value });
}

/** Whether `id` is a usable row id. */
export function isSourceRowId(id: unknown): id is SourceRowId {
  return (
    (typeof id === 'string' && id.length > 0 && id.length <= 256) ||
    (typeof id === 'number' && Number.isFinite(id))
  );
}

/**
 * Read one row from a response: a plain object with a usable key, keeping
 * the key and the projected (or every declared) field. A value that does
 * not fit its field's type becomes `null`; undeclared fields are dropped.
 * `null` when the row itself is unusable.
 */
export function readSourceRow(
  descriptor: SourceDescriptor,
  input: unknown,
  fields?: readonly string[]
): SourceRow | null {
  if (!isBag(input)) return null;
  const id = Object.hasOwn(input, descriptor.key) ? input[descriptor.key] : undefined;
  if (!isSourceRowId(id)) return null;
  const row: Record<string, SourceValue> = {};
  const names = fields ?? descriptor.fields.map((field) => field.name);
  for (const field of descriptor.fields) {
    if (field.name !== descriptor.key && !names.includes(field.name)) continue;
    const value = Object.hasOwn(input, field.name) ? input[field.name] : null;
    // The key was checked above; it keeps its value even when its type differs (a number id in a text key).
    Object.defineProperty(row, field.name, {
      value: field.name === descriptor.key ? id : fitsSourceField(field, value) ? value : null,
      enumerable: true,
    });
  }
  return Object.freeze(row);
}

function issue(code: SourceQueryIssue['code'], path: string, message: string): SourceQueryIssue {
  return Object.freeze({ code, path, message });
}

/** Check create or update values against the declaration: editable, fitting, required. */
function checkValues(
  descriptor: SourceDescriptor,
  input: unknown,
  mode: 'create' | 'update'
):
  | { ok: true; values: Readonly<Record<string, SourceValue>> }
  | { ok: false; issues: SourceQueryIssue[] } {
  const issues: SourceQueryIssue[] = [];
  if (!isBag(input)) return { ok: false, issues: [issue('shape', '$', 'Values are an object.')] };
  const keys = Object.keys(input);
  if (keys.length > SOURCE_LIMITS.changes || (mode === 'update' && keys.length === 0)) {
    return {
      ok: false,
      issues: [issue('shape', '$', `Change 1 to ${SOURCE_LIMITS.changes} fields.`)],
    };
  }
  const values: Record<string, SourceValue> = {};
  for (const key of keys) {
    const field = sourceField(descriptor, key);
    const path = `$.${key}`;
    if (!field)
      issues.push(issue('unknown-field', path, `"${descriptor.name}" has no "${key}" field.`));
    else if (!field.editable) issues.push(issue('value', path, `"${key}" cannot be changed.`));
    else if (!fitsSourceField(field, input[key]))
      issues.push(issue('value', path, `The value does not fit "${key}" (${field.type}).`));
    else Object.defineProperty(values, key, { value: input[key], enumerable: true });
  }
  if (mode === 'create') {
    for (const field of descriptor.fields) {
      if (field.required && (!Object.hasOwn(values, field.name) || values[field.name] === null)) {
        issues.push(issue('value', `$.${field.name}`, `"${field.name}" is required.`));
      }
    }
  }
  return issues.length > 0 ? { ok: false, issues } : { ok: true, values: Object.freeze(values) };
}

interface Inflight {
  readonly controller: AbortController;
  readonly promise: Promise<SourceResult<SourceListResult>>;
  waiters: number;
}

interface CacheEntry {
  readonly source: string;
  readonly value: SourceListResult;
  readonly at: number;
}

/** Create a loader over a registry. */
export function createSourceLoader(options: SourceLoaderOptions): SourceLoader {
  const { registry } = options;
  const clock = options.clock ?? SYSTEM_SOURCE_CLOCK;
  const retry: SourceRetryPolicy =
    options.retry === false
      ? { retries: 0, baseDelayMs: 0, maxDelayMs: 0 }
      : { ...DEFAULT_SOURCE_RETRY, ...(options.retry ?? {}) };
  const timeoutMs = options.timeoutMs ?? 15_000;
  const cacheOptions = options.cache === false ? null : (options.cache ?? {});
  const maxEntries = cacheOptions ? Math.max(0, cacheOptions.maxEntries ?? 64) : 0;
  const staleMs = cacheOptions ? Math.max(0, cacheOptions.staleMs ?? 30_000) : 0;

  const inflight = new Map<string, Inflight>();
  const cache = new Map<string, CacheEntry>();
  const generations = new Map<string, number>();
  const listeners = new Map<string, Set<(event: SourceInvalidation) => void>>();

  function source(name: string, op: SourceOperation): SourceResult<DataSource> {
    const found = registry.get(name);
    if (!found) {
      return failure(
        sourceError('unknown-source', {
          source: String(name).slice(0, 64),
          message: 'No such source.',
        })
      );
    }
    if (!found.descriptor.operations.includes(op)) {
      return failure(
        sourceError('unsupported', { source: name, message: `The source does not ${op}.` })
      );
    }
    return success(found);
  }

  function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(false);
        return;
      }
      const onAbort = () => {
        clock.clearTimeout(handle);
        resolve(false);
      };
      const handle = clock.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve(true);
      }, ms);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** One attempt: the adapter call raced against the attempt's timeout and the caller's abort. */
  async function once<T>(
    name: string,
    outer: AbortSignal,
    call: (signal: AbortSignal) => Promise<T>
  ): Promise<SourceResult<T>> {
    if (outer.aborted) return failure(sourceError('aborted', { source: name }));
    const controller = new AbortController();
    let timer: unknown;
    let settleGuard: (result: SourceResult<T>) => void = () => {};
    const guard = new Promise<SourceResult<T>>((resolve) => {
      settleGuard = resolve;
    });
    const forward = () => {
      controller.abort();
      settleGuard(failure(sourceError('aborted', { source: name })));
    };
    outer.addEventListener('abort', forward, { once: true });
    if (timeoutMs > 0) {
      timer = clock.setTimeout(() => {
        controller.abort();
        settleGuard(failure(sourceError('timeout', { source: name })));
      }, timeoutMs);
    }
    const attempt = Promise.resolve()
      .then(() => call(controller.signal))
      .then(
        (value) => success(value),
        (thrown: unknown) => failure<T>(toSourceError(thrown, name))
      );
    try {
      return await Promise.race([attempt, guard]);
    } finally {
      if (timer !== undefined) clock.clearTimeout(timer);
      outer.removeEventListener('abort', forward);
    }
  }

  /** Attempts with backoff while the failure is retryable and retries remain. */
  async function withRetries<T>(
    name: string,
    signal: AbortSignal,
    retries: number,
    call: (signal: AbortSignal) => Promise<T>
  ): Promise<SourceResult<T>> {
    for (let attempt = 0; ; attempt += 1) {
      const result = await once(name, signal, call);
      if (result.ok || !result.error.retryable || attempt >= retries || signal.aborted) {
        return result;
      }
      const backoff = Math.min(retry.maxDelayMs, retry.baseDelayMs * 2 ** attempt);
      const hint = result.error.retryAfterMs;
      const delay = hint === undefined ? backoff : Math.min(hint, MAX_RETRY_AFTER_MS);
      if (!(await sleep(delay, signal))) return failure(sourceError('aborted', { source: name }));
    }
  }

  /** Join a shared read; this caller's abort leaves it, and the last one out cancels it. */
  function join<T>(
    entry: { controller: AbortController; promise: Promise<SourceResult<T>>; waiters: number },
    signal: AbortSignal | undefined,
    name: string,
    drop: () => void
  ): Promise<SourceResult<T>> {
    if (signal?.aborted) return Promise.resolve(failure(sourceError('aborted', { source: name })));
    entry.waiters += 1;
    if (!signal) return entry.promise;
    return new Promise((resolve) => {
      let done = false;
      const onAbort = () => {
        if (done) return;
        done = true;
        resolve(failure(sourceError('aborted', { source: name })));
        entry.waiters -= 1;
        if (entry.waiters === 0) {
          drop();
          entry.controller.abort();
        }
      };
      signal.addEventListener('abort', onAbort, { once: true });
      void entry.promise.then((result) => {
        if (done) return;
        done = true;
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      });
    });
  }

  function cacheGet(key: string): SourceListResult | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (clock.now() - entry.at >= staleMs) {
      cache.delete(key);
      return undefined;
    }
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
  }

  function cacheSet(key: string, name: string, value: SourceListResult): void {
    if (maxEntries === 0 || staleMs === 0) return;
    cache.delete(key);
    cache.set(key, { source: name, value, at: clock.now() });
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  function checkQuery(name: string, query: unknown): SourceQueryResolution {
    const found = registry.get(name);
    if (!found) {
      return {
        ok: false,
        error: sourceError('unknown-source', {
          source: String(name).slice(0, 64),
          message: 'No such source.',
        }),
      };
    }
    const checked = checkSourceQuery(found.descriptor, query);
    if (!checked.ok) {
      const code = checked.issues.some((i) => i.code === 'operation')
        ? 'unsupported'
        : 'invalid-query';
      return {
        ok: false,
        error: sourceError(code, {
          source: name,
          issues: checked.issues,
          message: 'The query was refused.',
        }),
      };
    }
    return Object.freeze({ ok: true, query: checked.query, descriptor: found.descriptor });
  }

  type PageResolution =
    | {
        ok: true;
        key: string;
        resolution: { query: SourceQuery; descriptor: SourceDescriptor };
        size: number;
        cursor?: string;
        offset?: number;
      }
    | { ok: false; error: SourceError };

  function resolvePage(name: string, query: unknown, options: SourceListOptions): PageResolution {
    const resolved = checkQuery(name, query);
    if (!resolved.ok) return resolved;
    const { descriptor } = resolved;
    const size = resolved.query.pageSize ?? descriptor.defaultPageSize;
    const cursor = options.cursor ?? undefined;
    const offset = options.offset ?? undefined;
    const bad = (message: string): PageResolution => ({
      ok: false,
      error: sourceError('invalid-query', { source: name, message }),
    });
    if (cursor !== undefined) {
      if (descriptor.pagination !== 'cursor') return bad('This source does not page by cursor.');
      if (
        typeof cursor !== 'string' ||
        cursor === '' ||
        cursor.length > SOURCE_LIMITS.cursorLength
      ) {
        return bad('The cursor is malformed.');
      }
    }
    if (offset !== undefined) {
      if (descriptor.pagination !== 'offset') return bad('This source does not page by offset.');
      if (!Number.isInteger(offset) || offset < 0) return bad('The offset is malformed.');
    }
    const key = sourceQueryKey(name, resolved.query, {
      cursor: cursor ?? null,
      offset: offset ?? null,
    });
    return {
      ok: true,
      key,
      resolution: resolved,
      size,
      ...(cursor === undefined ? {} : { cursor }),
      ...(offset === undefined ? {} : { offset }),
    };
  }

  function readPage(
    descriptor: SourceDescriptor,
    query: SourceQuery,
    size: number,
    offset: number | undefined,
    input: unknown
  ): SourceResult<SourceListResult> {
    const invalid = (message: string) =>
      failure<SourceListResult>(
        sourceError('invalid-response', { source: descriptor.name, message })
      );
    if (!isBag(input) || !Array.isArray(input.rows)) return invalid('A page has a rows array.');
    if (input.rows.length > size) return invalid(`The page holds more than ${size} rows.`);
    const rows: SourceRow[] = [];
    const seen = new Set<string>();
    for (const raw of input.rows) {
      const row = readSourceRow(descriptor, raw, query.fields);
      if (!row) return invalid('A row is not an object with a usable key.');
      const id = `${typeof row[descriptor.key]}:${String(row[descriptor.key])}`;
      if (seen.has(id)) return invalid('Two rows share a key.');
      seen.add(id);
      rows.push(row);
    }
    let nextCursor: string | null = null;
    let nextOffset: number | null = null;
    let hasMore = false;
    if (descriptor.pagination === 'cursor') {
      const next = input.nextCursor;
      if (next !== undefined && next !== null) {
        if (typeof next !== 'string' || next === '' || next.length > SOURCE_LIMITS.cursorLength) {
          return invalid('nextCursor is malformed.');
        }
        nextCursor = next;
        hasMore = true;
      }
    } else if (descriptor.pagination === 'offset') {
      hasMore = typeof input.hasMore === 'boolean' ? input.hasMore : rows.length === size;
      if (rows.length === 0) hasMore = false;
      if (hasMore) nextOffset = (offset ?? 0) + rows.length;
    }
    const total =
      typeof input.total === 'number' && Number.isInteger(input.total) && input.total >= 0
        ? input.total
        : null;
    return success(
      Object.freeze({
        rows: Object.freeze(rows),
        pageSize: size,
        hasMore,
        nextCursor,
        nextOffset,
        total,
      })
    );
  }

  function list(
    name: string,
    query: unknown,
    options: SourceListOptions = {}
  ): Promise<SourceResult<SourceListResult>> {
    const page = resolvePage(name, query, options);
    if (!page.ok) return Promise.resolve(failure(page.error));
    if (
      !page.resolution.descriptor.operations.includes('list') &&
      page.resolution.query.search === undefined
    ) {
      // A search-only source lists through search text.
      return Promise.resolve(
        failure(
          sourceError('unsupported', {
            source: name,
            message: 'This source lists only with search text.',
          })
        )
      );
    }
    const { key, size } = page;
    // A caller that already left starts nothing.
    if (options.signal?.aborted) {
      return Promise.resolve(failure(sourceError('aborted', { source: name })));
    }
    if (!options.fresh) {
      const hit = cacheGet(key);
      if (hit) return Promise.resolve(success(hit));
    }
    let entry = inflight.get(key);
    if (!entry) {
      const found = registry.get(name) as DataSource;
      const adapter = found.adapter as Required<Pick<SourceAdapter, 'list'>>;
      const { descriptor, query: checkedQuery } = page.resolution;
      const generation = generations.get(name) ?? 0;
      const controller = new AbortController();
      const request = {
        size,
        ...(page.cursor === undefined ? {} : { cursor: page.cursor }),
        ...(page.offset === undefined ? {} : { offset: page.offset }),
      };
      const promise = withRetries(name, controller.signal, retry.retries, (signal) =>
        adapter.list({ query: checkedQuery, page: Object.freeze(request), signal })
      ).then((result) => {
        if (inflight.get(key) === created) inflight.delete(key);
        if (!result.ok) return result;
        const read = readPage(descriptor, checkedQuery, size, page.offset, result.value);
        // A page that started before an invalidation is not cached.
        if (read.ok && (generations.get(name) ?? 0) === generation) cacheSet(key, name, read.value);
        return read;
      });
      const created: Inflight = { controller, promise, waiters: 0 };
      entry = created;
      inflight.set(key, created);
    }
    const shared = entry;
    return join(shared, options.signal, name, () => {
      if (inflight.get(key) === shared) inflight.delete(key);
    });
  }

  function peek(
    name: string,
    query: unknown,
    options: SourceListOptions = {}
  ): SourceListResult | undefined {
    const page = resolvePage(name, query, options);
    return page.ok ? cacheGet(page.key) : undefined;
  }

  /** A single read or write: no sharing, optional retries. */
  function single<T>(
    name: string,
    signal: AbortSignal | undefined,
    retries: number,
    call: (signal: AbortSignal) => Promise<T>
  ): Promise<SourceResult<T>> {
    if (signal?.aborted) return Promise.resolve(failure(sourceError('aborted', { source: name })));
    const controller = new AbortController();
    const entry = {
      controller,
      promise: withRetries(name, controller.signal, retries, call),
      waiters: 0,
    };
    return join(entry, signal, name, () => {});
  }

  function invalidate(name?: string, origin?: unknown): void {
    const names =
      name === undefined ? [...new Set([...generations.keys(), ...listeners.keys()])] : [name];
    for (const [key, entry] of cache) {
      if (name === undefined || entry.source === name) cache.delete(key);
    }
    for (const each of names) {
      generations.set(each, (generations.get(each) ?? 0) + 1);
      const event: SourceInvalidation = Object.freeze({
        source: each,
        ...(origin === undefined ? {} : { origin }),
      });
      for (const listener of [...(listeners.get(each) ?? [])]) {
        try {
          listener(event);
        } catch {
          // A listener's failure never stops the others.
        }
      }
    }
  }

  async function write<T>(
    name: string,
    op: 'create' | 'update' | 'delete',
    options: SourceMutationOptions,
    call: (found: DataSource, signal: AbortSignal) => Promise<SourceResult<T>>
  ): Promise<SourceResult<T>> {
    const found = source(name, op);
    if (!found.ok) return failure(found.error);
    // Writes are not retried: a write that may have landed must not land twice.
    const result = await single(name, options.signal, 0, (signal) =>
      call(found.value, signal).then((inner) => {
        if (!inner.ok) throw inner.error;
        return inner.value;
      })
    );
    if (result.ok) invalidate(name, options.origin);
    return result;
  }

  const loader: SourceLoader = {
    registry,
    checkQuery,
    list,
    peek,
    get(name, id, options = {}) {
      const found = source(name, 'get');
      if (!found.ok) return Promise.resolve(failure(found.error));
      if (!isSourceRowId(id)) {
        return Promise.resolve(
          failure(sourceError('invalid-input', { source: name, message: 'The id is malformed.' }))
        );
      }
      const { descriptor, adapter } = found.value;
      return single(name, options.signal, retry.retries, async (signal) => {
        const raw = await (adapter.get as NonNullable<SourceAdapter['get']>)({ id, signal });
        if (raw === null || raw === undefined) return null;
        const row = readSourceRow(descriptor, raw);
        if (!row)
          throw sourceError('invalid-response', { source: name, message: 'The row is unusable.' });
        return row;
      });
    },
    create(name, values, options = {}) {
      return write<SourceRow>(name, 'create', options, async (found, signal) => {
        const checked = checkValues(found.descriptor, values, 'create');
        if (!checked.ok) {
          return failure(sourceError('invalid-input', { source: name, issues: checked.issues }));
        }
        const raw = await (found.adapter.create as NonNullable<SourceAdapter['create']>)({
          values: checked.values,
          signal,
        });
        const row = readSourceRow(found.descriptor, raw);
        return row
          ? success(row)
          : failure(
              sourceError('invalid-response', {
                source: name,
                message: 'The created row is unusable.',
              })
            );
      });
    },
    update(name, id, changes, options = {}) {
      return write<SourceRow>(name, 'update', options, async (found, signal) => {
        if (!isSourceRowId(id))
          return failure(
            sourceError('invalid-input', { source: name, message: 'The id is malformed.' })
          );
        const checked = checkValues(found.descriptor, changes, 'update');
        if (!checked.ok) {
          return failure(sourceError('invalid-input', { source: name, issues: checked.issues }));
        }
        const raw = await (found.adapter.update as NonNullable<SourceAdapter['update']>)({
          id,
          changes: checked.values,
          signal,
        });
        const row = readSourceRow(found.descriptor, raw);
        return row
          ? success(row)
          : failure(
              sourceError('invalid-response', {
                source: name,
                message: 'The updated row is unusable.',
              })
            );
      });
    },
    remove(name, id, options = {}) {
      return write<null>(name, 'delete', options, async (found, signal) => {
        if (!isSourceRowId(id))
          return failure(
            sourceError('invalid-input', { source: name, message: 'The id is malformed.' })
          );
        await (found.adapter.delete as NonNullable<SourceAdapter['delete']>)({ id, signal });
        return success(null);
      });
    },
    invalidate,
    subscribe(name, listener) {
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
        if (set?.size === 0) listeners.delete(name);
      };
    },
    inFlight: () => inflight.size,
  };
  return Object.freeze(loader);
}
