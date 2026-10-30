/**
 * The player's data-source runtime (spec 0.8.0, ADR-015), framework-free.
 * One view per bound prop (`path` + `prop`) holds a `@texuli/core`
 * source collection: it loads through the host's registry, pages, maps
 * rows to the component's items, and writes a component's edits back as
 * optimistic updates that roll back when the source refuses them. The
 * player loads this module only when the host passes a source registry or
 * loader, so a player without data sources pays nothing for it.
 */

import {
  canRetrySourceError,
  createSourceCollection,
  createSourceLoader,
  fitsSourceField,
  type SourceCollection,
  type SourceCollectionState,
  type SourceError,
  type SourceErrorMessageKey,
  type SourceLoader,
  type SourceRegistry,
  type SourceRowId,
  type SourceValue,
  sourceErrorMessage,
  stableJson,
} from '@texuli/core/data-source';
import { changesFromItem, itemsFromRows, type SourceShape, sourceShape } from './shapes.ts';

type Item = Readonly<Record<string, unknown>>;

/** One bound prop found by the resolver. */
export interface SourceBindingRef {
  readonly path: string;
  readonly prop: string;
  /** The node's catalog id. */
  readonly id: string;
  readonly binding: Readonly<Record<string, unknown>>;
}

export interface SourceViewError {
  readonly code: SourceError['code'];
  /** The user-facing message (never the adapter's text). */
  readonly message: string;
  /** Whether a retry button can help. */
  readonly canRetry: boolean;
}

/** What a bound node shows around its component. */
export interface SourceViewState {
  readonly status: 'loading' | 'ready' | 'error';
  readonly count: number;
  readonly refreshing: boolean;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly error: SourceViewError | null;
  readonly moreError: SourceViewError | null;
  readonly writeError: SourceViewError | null;
  readonly pending: number;
}

/** What the player announces politely. */
export type SourceViewEvent =
  | { readonly kind: 'failed'; readonly path: string; readonly message: string }
  | { readonly kind: 'more'; readonly path: string; readonly count: number }
  | { readonly kind: 'save-failed'; readonly path: string; readonly message: string };

export interface SourceViewsOptions {
  /** A shared loader (its cache and in-flight reads span players). */
  loader?: SourceLoader | null;
  /** Used when no loader is given: the player makes its own loader over it. */
  registry?: SourceRegistry | null;
  /** Called after any view changed; the player re-resolves its tree. */
  onChange(): void;
  onEvent?(event: SourceViewEvent): void;
  /** Host translations of the user-facing error messages, by message key (read when shown). */
  errorMessages?: () => Partial<Record<SourceErrorMessageKey, string>>;
}

export interface SourceViews {
  readonly loader: SourceLoader | null;
  /** Create views for new bindings, keep unchanged ones, and drop the rest. */
  sync(bindings: readonly SourceBindingRef[]): void;
  /** The items a bound prop shows now, or `undefined` before its view exists. */
  items(path: string, prop: string, binding: unknown): readonly Item[] | undefined;
  state(path: string): SourceViewState | null;
  retry(path: string): void;
  loadMore(path: string): void;
  /**
   * Write a component's edited items back as optimistic updates. Resolves
   * `true` when every update landed, `false` when nothing the source can
   * store changed or an update was refused (and rolled back).
   */
  write(path: string, prop: string, next: unknown): Promise<boolean>;
  destroy(): void;
}

interface View {
  readonly ref: SourceBindingRef;
  readonly bindingKey: string;
  readonly shape: SourceShape;
  readonly map: Readonly<Record<string, string>> | undefined;
  readonly collection: SourceCollection;
  items: readonly Item[];
  rows: SourceCollectionState['rows'];
  state: SourceViewState;
  unsubscribe(): void;
}

const LOADING: SourceViewState = Object.freeze({
  status: 'loading',
  count: 0,
  refreshing: false,
  hasMore: false,
  loadingMore: false,
  error: null,
  moreError: null,
  writeError: null,
  pending: 0,
});

/** A view's state while the runtime itself is still loading. */
export const SOURCE_VIEW_LOADING = LOADING;

const keyOf = (path: string, prop: string) => `${path}\u0000${prop}`;

function mapOf(
  binding: Readonly<Record<string, unknown>>
): Readonly<Record<string, string>> | undefined {
  const map = binding.map;
  if (typeof map !== 'object' || map === null || Array.isArray(map)) return undefined;
  const out: Record<string, string> = {};
  for (const [field, source] of Object.entries(map)) {
    if (typeof source === 'string')
      Object.defineProperty(out, field, { value: source, enumerable: true });
  }
  return Object.freeze(out);
}

export function createSourceViews(options: SourceViewsOptions): SourceViews {
  const loader =
    options.loader ??
    (options.registry ? createSourceLoader({ registry: options.registry }) : null);
  const views = new Map<string, View>();
  let destroyed = false;

  const viewError = (error: SourceError | null): SourceViewError | null =>
    error
      ? Object.freeze({
          code: error.code,
          message: sourceErrorMessage(error, options.errorMessages?.()),
          canRetry: canRetrySourceError(error),
        })
      : null;

  function project(view: View, next: SourceCollectionState): void {
    const before = view.state;
    if (next.rows !== view.rows) {
      view.rows = next.rows;
      view.items = itemsFromRows(
        view.shape,
        next.rows,
        view.collection.descriptor?.key ?? 'id',
        view.map
      );
    }
    const status: SourceViewState['status'] =
      next.status === 'error' ? 'error' : next.status === 'ready' ? 'ready' : 'loading';
    view.state = Object.freeze({
      status,
      count: view.items.length,
      refreshing: next.refreshing,
      hasMore: next.hasMore && view.items.length < view.shape.maxItems,
      loadingMore: next.loadingMore,
      error: viewError(next.error),
      moreError: viewError(next.moreError),
      writeError: viewError(next.writeError),
      pending: next.pending,
    });
    const path = view.ref.path;
    const after = view.state;
    if (after.error && after.status === 'error' && before.status !== 'error') {
      options.onEvent?.({ kind: 'failed', path, message: after.error.message });
    }
    if (after.moreError && !before.moreError) {
      options.onEvent?.({ kind: 'failed', path, message: after.moreError.message });
    }
    if (before.loadingMore && !after.loadingMore && !after.moreError) {
      options.onEvent?.({ kind: 'more', path, count: Math.max(0, after.count - before.count) });
    }
    if (
      after.writeError &&
      next.writeError !== null &&
      before.writeError?.code !== after.writeError.code
    ) {
      options.onEvent?.({ kind: 'save-failed', path, message: after.writeError.message });
    }
  }

  function open(ref: SourceBindingRef, bindingKey: string, shape: SourceShape): View | null {
    if (!loader) return null;
    const binding = ref.binding;
    const collection = createSourceCollection(loader, String(binding.$source), binding.query ?? {});
    const view: View = {
      ref,
      bindingKey,
      shape,
      map: mapOf(binding),
      collection,
      items: Object.freeze([]),
      rows: Object.freeze([]),
      state: LOADING,
      unsubscribe: () => {},
    };
    view.unsubscribe = collection.subscribe((next) => {
      if (destroyed) return;
      project(view, next);
      options.onChange();
    });
    project(view, collection.state);
    void collection.load();
    return view;
  }

  function close(view: View): void {
    view.unsubscribe();
    view.collection.destroy();
  }

  function first(path: string): View | undefined {
    for (const view of views.values()) if (view.ref.path === path) return view;
    return undefined;
  }

  return {
    loader,
    sync(bindings) {
      if (destroyed) return;
      const keep = new Set<string>();
      let changed = false;
      for (const ref of bindings) {
        const key = keyOf(ref.path, ref.prop);
        const shape = sourceShape(ref.id, ref.prop);
        if (!shape) continue;
        const bindingKey = stableJson(ref.binding);
        keep.add(key);
        const current = views.get(key);
        if (current && current.bindingKey === bindingKey && current.ref.id === ref.id) continue;
        if (current) close(current);
        const view = open(ref, bindingKey, shape);
        if (view) views.set(key, view);
        else views.delete(key);
        changed = true;
      }
      for (const [key, view] of views) {
        if (keep.has(key)) continue;
        close(view);
        views.delete(key);
        changed = true;
      }
      if (changed) options.onChange();
    },
    items(path, prop, binding) {
      const view = views.get(keyOf(path, prop));
      if (!view || view.bindingKey !== stableJson(binding)) return undefined;
      return view.items;
    },
    state(path) {
      return first(path)?.state ?? null;
    },
    retry(path) {
      void first(path)?.collection.retry();
    },
    loadMore(path) {
      const view = first(path);
      if (view?.state.hasMore) void view.collection.loadMore();
    },
    write(path, prop, next) {
      const view = views.get(keyOf(path, prop));
      const descriptor = view?.collection.descriptor;
      if (!view || !descriptor || !Array.isArray(next) || view.state.status !== 'ready') {
        return Promise.resolve(false);
      }
      const before = new Map(view.items.map((item) => [item.id as string, item]));
      const rows = new Map(view.rows.map((row) => [String(row[descriptor.key]), row]));
      const updates: Promise<boolean>[] = [];
      for (const item of next) {
        if (typeof item !== 'object' || item === null || typeof (item as Item).id !== 'string')
          continue;
        const id = (item as Item).id as string;
        const previous = before.get(id);
        const row = rows.get(id);
        if (!previous || !row) continue;
        const changes = changesFromItem(view.shape, previous, item as Item, descriptor, view.map);
        const fitting: Record<string, SourceValue> = {};
        for (const [field, value] of Object.entries(changes)) {
          const declared = descriptor.fields.find((entry) => entry.name === field);
          if (declared && fitsSourceField(declared, value)) {
            Object.defineProperty(fitting, field, { value, enumerable: true });
          }
        }
        if (Object.keys(fitting).length === 0) continue;
        updates.push(
          view.collection
            .update(row[descriptor.key] as SourceRowId, fitting)
            .then((result) => result.ok)
        );
      }
      if (updates.length === 0) {
        // Nothing the source can store changed: hand the component its items
        // again (a new list), so a move it made locally snaps back.
        view.items = Object.freeze([...view.items]);
        options.onChange();
        return Promise.resolve(false);
      }
      return Promise.all(updates).then((results) => results.every(Boolean));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const view of views.values()) close(view);
      views.clear();
    },
  };
}
