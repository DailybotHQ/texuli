import { createToastManager, type ToastManager } from '@texuli/primitives/toast';
import {
  DEFAULT_TOAST_DURATION,
  MAX_TOASTS,
  type PromiseToastMessages,
  type ToastItem,
  type ToastKind,
  type ToastOptions,
} from './types.ts';

export type ToastStore = {
  /** Reactive snapshot for the Toaster viewport. */
  readonly items: () => readonly ToastItem[];
  subscribe: (listener: (items: readonly ToastItem[]) => void) => () => void;
  /** Underlying primitive manager (for custom Provider wiring). */
  readonly manager: ToastManager;
  show: (kind: ToastKind, title: string, options?: ToastOptions) => string;
  success: (title: string, options?: ToastOptions) => string;
  error: (title: string, options?: ToastOptions) => string;
  info: (title: string, options?: ToastOptions) => string;
  warning: (title: string, options?: ToastOptions) => string;
  /**
   * Publish a loading toast, then replace it with success/error when the
   * promise settles. Returns the stable toast id.
   */
  promise: <T>(promise: Promise<T>, messages: PromiseToastMessages) => string;
  dismiss: (id?: string) => void;
};

type Meta = {
  kind: ToastKind;
  action?: ToastOptions['action'];
  pending?: boolean;
};

function resolveMessage(value: string | ((arg: unknown) => string), arg: unknown): string {
  return typeof value === 'function' ? value(arg) : value;
}

function resolveOptional(
  value: string | ((arg: unknown) => string | undefined) | undefined,
  arg: unknown
): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'function' ? value(arg) : value;
}

/**
 * Styled toast API on top of the primitive queue. Visual kind and actions
 * live here; the primitive owns R16 viewport, timers, and announcer wiring.
 */
export function createToastStore(options?: {
  /**
   * Default duration for every toast from this store (`0` keeps them until
   * dismissed). Without it each kind uses DEFAULT_TOAST_DURATION.
   */
  duration?: number;
  max?: number;
  createId?: () => string;
  now?: () => number;
}): ToastStore {
  const manager = createToastManager({
    duration: options?.duration ?? 5000,
    max: options?.max ?? MAX_TOASTS,
    createId: options?.createId,
    now: options?.now,
  });
  const storeDuration = options?.duration;
  const meta = new Map<string, Meta>();
  const listeners = new Set<(items: readonly ToastItem[]) => void>();

  function snapshot(): ToastItem[] {
    return manager.list().map((record) => {
      const extra = meta.get(record.id);
      const item: ToastItem = {
        id: record.id,
        kind: extra?.kind ?? 'info',
        title: record.title,
        duration: record.duration,
        pending: extra?.pending === true,
        createdAt: record.createdAt,
        priority: record.priority,
        tone: record.tone,
      };
      if (record.description) item.description = record.description;
      if (extra?.action) item.action = extra.action;
      return item;
    });
  }

  function emit(): void {
    const items = snapshot();
    for (const listener of listeners) listener(items);
  }

  manager.subscribe(() => {
    // Drop meta for dismissed toasts.
    const live = new Set(manager.list().map((t) => t.id));
    for (const id of meta.keys()) {
      if (!live.has(id)) meta.delete(id);
    }
    emit();
  });

  function show(kind: ToastKind, title: string, options: ToastOptions = {}): string {
    const duration = options.duration ?? storeDuration ?? DEFAULT_TOAST_DURATION[kind];
    const id = manager.publish({
      id: options.id,
      title,
      description: options.description,
      duration,
      tone: kind === 'error' ? 'foreground' : 'background',
      priority: kind === 'error' ? 'high' : 'normal',
    });
    meta.set(id, {
      kind,
      ...(options.action ? { action: options.action } : {}),
      pending: false,
    });
    emit();
    return id;
  }

  const store: ToastStore = {
    items: () => snapshot(),
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => {
        listeners.delete(listener);
      };
    },
    manager,
    show,
    success: (title, options) => show('success', title, options),
    error: (title, options) => show('error', title, options),
    info: (title, options) => show('info', title, options),
    warning: (title, options) => show('warning', title, options),
    promise(promise, messages) {
      const id = show('info', messages.loading, {
        description: messages.loadingDescription,
        duration: 0,
      });
      meta.set(id, { kind: 'info', pending: true });
      emit();
      void promise.then(
        (value) => {
          show('success', resolveMessage(messages.success, value), {
            id,
            description: resolveOptional(messages.successDescription, value),
            duration: DEFAULT_TOAST_DURATION.success,
          });
        },
        (error) => {
          show('error', resolveMessage(messages.error, error), {
            id,
            description: resolveOptional(messages.errorDescription, error),
            duration: DEFAULT_TOAST_DURATION.error,
          });
        }
      );
      return id;
    },
    dismiss(id) {
      if (id === undefined) {
        manager.dismissAll();
        meta.clear();
        emit();
        return;
      }
      manager.dismiss(id);
      meta.delete(id);
      emit();
    },
  };

  return store;
}

/** Shared app-level toaster (optional singleton). Create your own for tests. */
let defaultStore: ToastStore | undefined;

export function getToastStore(): ToastStore {
  if (!defaultStore) defaultStore = createToastStore();
  return defaultStore;
}

export function resetToastStore(): void {
  defaultStore?.dismiss();
  defaultStore = undefined;
}

/** Convenience aliases on the default store. */
export const toast = {
  show: (kind: ToastKind, title: string, options?: ToastOptions) =>
    getToastStore().show(kind, title, options),
  success: (title: string, options?: ToastOptions) => getToastStore().success(title, options),
  error: (title: string, options?: ToastOptions) => getToastStore().error(title, options),
  info: (title: string, options?: ToastOptions) => getToastStore().info(title, options),
  warning: (title: string, options?: ToastOptions) => getToastStore().warning(title, options),
  promise: <T>(promise: Promise<T>, messages: PromiseToastMessages) =>
    getToastStore().promise(promise, messages),
  dismiss: (id?: string) => getToastStore().dismiss(id),
  subscribe: (listener: (items: readonly ToastItem[]) => void) =>
    getToastStore().subscribe(listener),
  get items() {
    return getToastStore().items();
  },
  get manager() {
    return getToastStore().manager;
  },
};
