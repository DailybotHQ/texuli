/**
 * A source collection: the rows one view shows for one query, paged, with
 * optimistic writes. Confirmed rows (`base`) and pending writes are kept
 * apart; what a view sees is the base with every pending write applied in
 * order. A write that succeeds folds the source's row into the base; one
 * that fails is dropped, which rolls it back exactly, even while other
 * writes are pending. Framework-free: a view subscribes and re-reads
 * `state`.
 */

import { type SourceError, sourceError } from './errors.ts';
import type { SourceListResult, SourceLoader, SourceResult } from './loader.ts';
import type { SourceQuery, SourceValue } from './query.ts';
import type { SourceRow, SourceRowId } from './registry.ts';
import type { SourceDescriptor } from './schema.ts';

export type SourceCollectionStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SourceCollectionState {
  readonly status: SourceCollectionStatus;
  /** Confirmed rows with the pending writes applied. */
  readonly rows: readonly SourceRow[];
  /** Why the last load failed (`status` is `error`). Rows from before it stay. */
  readonly error: SourceError | null;
  /** A reload is running over rows already shown. */
  readonly refreshing: boolean;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  /** Why the last `loadMore` failed; the loaded rows stay. */
  readonly moreError: SourceError | null;
  readonly total: number | null;
  /** Optimistic writes in flight. */
  readonly pending: number;
  /** The last write that failed (and was rolled back). Cleared by the next write. */
  readonly writeError: SourceError | null;
  /** Bumped on every change. */
  readonly version: number;
}

export interface SourceCollectionOptions {
  /** Reload when another view writes to the same source. Default `true`. */
  autoRefresh?: boolean;
  /** Where optimistic creates appear. Default `end`. */
  createAt?: 'start' | 'end';
}

export interface SourceCollection {
  readonly state: SourceCollectionState;
  /** The source's descriptor, or `null` when the name or query was refused. */
  readonly descriptor: SourceDescriptor | null;
  /** The validated query, or `null` when it was refused. */
  readonly query: SourceQuery | null;
  /** Load the first page (again). Rows already shown stay until it lands. */
  load(): Promise<void>;
  /** Append the next page, when there is one. */
  loadMore(): Promise<void>;
  /** After a failure: reload, or ask for the failed next page again. */
  retry(): Promise<void>;
  /** Change fields of a row, optimistically. */
  update(
    id: SourceRowId,
    changes: Readonly<Record<string, SourceValue>>
  ): Promise<SourceResult<SourceRow>>;
  /** Add a row, optimistically (with a temporary key until the source answers). */
  create(values: Readonly<Record<string, SourceValue>>): Promise<SourceResult<SourceRow>>;
  /** Remove a row, optimistically. */
  remove(id: SourceRowId): Promise<SourceResult<null>>;
  subscribe(listener: (state: SourceCollectionState) => void): () => void;
  /** Cancel everything in flight and stop listening. The state stays readable. */
  destroy(): void;
}

type Pending =
  | {
      readonly seq: number;
      readonly kind: 'update';
      readonly id: SourceRowId;
      readonly changes: Readonly<Record<string, SourceValue>>;
    }
  | { readonly seq: number; readonly kind: 'create'; readonly row: SourceRow }
  | { readonly seq: number; readonly kind: 'remove'; readonly id: SourceRowId };

/** The prefix of a temporary key: an optimistic row the source has not confirmed. */
export const PENDING_ROW_PREFIX = 'pending:';

const INITIAL: SourceCollectionState = Object.freeze({
  status: 'idle',
  rows: Object.freeze([]),
  error: null,
  refreshing: false,
  hasMore: false,
  loadingMore: false,
  moreError: null,
  total: null,
  pending: 0,
  writeError: null,
  version: 0,
});

function project(
  row: SourceRow,
  like: SourceRow | undefined,
  fields: readonly string[] | undefined,
  key: string
): SourceRow {
  const names = like ? Object.keys(like) : fields ? [key, ...fields] : Object.keys(row);
  const out: Record<string, SourceValue> = {};
  for (const name of names) {
    if (Object.hasOwn(row, name))
      Object.defineProperty(out, name, { value: row[name] ?? null, enumerable: true });
  }
  return Object.freeze(out);
}

/** Create a collection over one source and query. Nothing loads until `load()`. */
export function createSourceCollection(
  loader: SourceLoader,
  name: string,
  query: unknown,
  options: SourceCollectionOptions = {}
): SourceCollection {
  const resolution = loader.checkQuery(name, query);
  const descriptor = resolution.ok ? resolution.descriptor : null;
  const checked = resolution.ok ? resolution.query : null;
  const key = descriptor?.key ?? 'id';
  const origin = Object.freeze({ collection: name });
  const listeners = new Set<(state: SourceCollectionState) => void>();
  let state: SourceCollectionState = resolution.ok
    ? INITIAL
    : Object.freeze({ ...INITIAL, status: 'error', error: resolution.error, version: 1 });
  let base: readonly SourceRow[] = [];
  let pending: readonly Pending[] = [];
  let nextCursor: string | null = null;
  let nextOffset: number | null = null;
  let loadController: AbortController | null = null;
  let moreController: AbortController | null = null;
  const writeControllers = new Set<AbortController>();
  let seq = 0;
  let destroyed = false;

  const same = (row: SourceRow, id: SourceRowId) => row[key] === id;

  function visible(): readonly SourceRow[] {
    let rows = base;
    for (const write of pending) {
      if (write.kind === 'update') {
        rows = rows.map((row) =>
          same(row, write.id)
            ? Object.freeze({ ...row, ...write.changes, [key]: row[key] ?? null })
            : row
        );
      } else if (write.kind === 'remove') {
        rows = rows.filter((row) => !same(row, write.id));
      } else {
        rows = options.createAt === 'start' ? [write.row, ...rows] : [...rows, write.row];
      }
    }
    return Object.freeze(rows);
  }

  function commit(patch: Partial<SourceCollectionState>): void {
    state = Object.freeze({
      ...state,
      ...patch,
      rows: visible(),
      pending: pending.length,
      version: state.version + 1,
    });
    for (const listener of [...listeners]) {
      try {
        listener(state);
      } catch {
        // A listener's failure never stops the others.
      }
    }
  }

  function applyPage(page: SourceListResult): void {
    nextCursor = page.nextCursor;
    nextOffset = page.nextOffset;
  }

  async function load(): Promise<void> {
    if (destroyed || !checked) return;
    loadController?.abort();
    moreController?.abort();
    const controller = new AbortController();
    loadController = controller;
    const hasRows = base.length > 0;
    commit({
      status: hasRows ? (state.status === 'error' ? 'loading' : 'ready') : 'loading',
      refreshing: hasRows,
      loadingMore: false,
      moreError: null,
    });
    const result = await loader.list(name, checked, { signal: controller.signal, fresh: hasRows });
    if (controller !== loadController || destroyed) return;
    loadController = null;
    if (!result.ok) {
      if (result.error.code === 'aborted') return;
      commit({ status: 'error', error: result.error, refreshing: false });
      return;
    }
    base = result.value.rows;
    applyPage(result.value);
    commit({
      status: 'ready',
      error: null,
      refreshing: false,
      hasMore: result.value.hasMore,
      total: result.value.total,
    });
  }

  async function loadMore(): Promise<void> {
    if (destroyed || !checked || !state.hasMore || state.loadingMore || state.status !== 'ready')
      return;
    const controller = new AbortController();
    moreController = controller;
    commit({ loadingMore: true, moreError: null });
    const result = await loader.list(name, checked, {
      signal: controller.signal,
      ...(nextCursor === null ? {} : { cursor: nextCursor }),
      ...(nextOffset === null ? {} : { offset: nextOffset }),
    });
    if (controller !== moreController || destroyed) return;
    moreController = null;
    if (!result.ok) {
      if (result.error.code === 'aborted') return;
      commit({ loadingMore: false, moreError: result.error });
      return;
    }
    // A row that shifted into the next page while paging is shown once.
    const known = new Set(base.map((row) => `${typeof row[key]}:${String(row[key])}`));
    const fresh = result.value.rows.filter(
      (row) => !known.has(`${typeof row[key]}:${String(row[key])}`)
    );
    base = Object.freeze([...base, ...fresh]);
    applyPage(result.value);
    commit({
      loadingMore: false,
      hasMore: result.value.hasMore,
      total: result.value.total ?? state.total,
    });
  }

  async function mutate<T>(
    write: Pending,
    run: (signal: AbortSignal) => Promise<SourceResult<T>>,
    settle: (value: T) => void
  ): Promise<SourceResult<T>> {
    if (destroyed || !descriptor) {
      return { ok: false, error: state.error ?? sourceError('failed', { source: name }) };
    }
    pending = [...pending, write];
    commit({ writeError: null });
    const controller = new AbortController();
    writeControllers.add(controller);
    const result = await run(controller.signal);
    writeControllers.delete(controller);
    pending = pending.filter((entry) => entry !== write);
    if (destroyed) return result;
    if (result.ok) {
      settle(result.value);
      commit({});
    } else {
      // Dropping the pending write is the rollback.
      commit({ writeError: result.error });
    }
    return result;
  }

  const collection: SourceCollection = {
    get state() {
      return state;
    },
    descriptor,
    query: checked,
    load,
    loadMore,
    retry() {
      if (state.status === 'error') return load();
      if (state.moreError) return loadMore();
      return Promise.resolve();
    },
    update(id, changes) {
      seq += 1;
      const write: Pending = { seq, kind: 'update', id, changes: Object.freeze({ ...changes }) };
      return mutate(
        write,
        (signal) => loader.update(name, id, changes, { signal, origin }),
        (row) => {
          base = Object.freeze(
            base.map((existing) =>
              same(existing, id) ? project(row, existing, checked?.fields, key) : existing
            )
          );
        }
      );
    },
    create(values) {
      seq += 1;
      const temp = Object.freeze({ ...values, [key]: `${PENDING_ROW_PREFIX}${seq}` });
      const write: Pending = { seq, kind: 'create', row: temp };
      return mutate(
        write,
        (signal) => loader.create(name, values, { signal, origin }),
        (row) => {
          if (base.some((existing) => same(existing, row[key] as SourceRowId))) return;
          const added = project(row, undefined, checked?.fields, key);
          base = Object.freeze(options.createAt === 'start' ? [added, ...base] : [...base, added]);
        }
      );
    },
    remove(id) {
      seq += 1;
      const write: Pending = { seq, kind: 'remove', id };
      return mutate(
        write,
        (signal) => loader.remove(name, id, { signal, origin }),
        () => {
          base = Object.freeze(base.filter((existing) => !same(existing, id)));
        }
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      loadController?.abort();
      moreController?.abort();
      for (const controller of writeControllers) controller.abort();
      writeControllers.clear();
      listeners.clear();
    },
  };

  // Another view's write to this source reloads this one; this view's own writes do not.
  const unsubscribe =
    options.autoRefresh === false || !descriptor
      ? () => {}
      : loader.subscribe(name, (event) => {
          if (event.origin !== origin && state.status !== 'idle') void load();
        });

  return Object.freeze(collection);
}
