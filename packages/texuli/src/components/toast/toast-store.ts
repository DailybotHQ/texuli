import { createToastManager, type ToastManager } from '@texuli/primitives/toast';
import {
  DEFAULT_TOAST_ACTION_ERROR,
  DEFAULT_TOAST_DURATION,
  MAX_TOASTS,
  type PromiseToastMessages,
  type ToastAnnouncement,
  type ToastItem,
  type ToastKind,
  type ToastOptions,
  type ToastSettleReason,
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
  /** Dismiss one toast, or every toast without an id. Settles with `'dismiss'`. */
  dismiss: (id?: string) => void;
  /**
   * Run a toast's action, keep it while a returned promise runs, then dismiss
   * it and settle with `'action'` (also when the action rejects; the error is
   * rethrown on a microtask). The toast's timer stops while the action runs.
   * With `action.retryOnError` a rejection keeps the toast unsettled, with
   * its `error` message and a fresh timer, so the action can run again.
   */
  action: (id: string) => Promise<void>;
  /**
   * Pause every toast timer; each keeps its remaining time. Holds stack by
   * key: timers run again only when every key has resumed. The Toaster holds
   * its own key while the pointer or focus is in its region. Default key
   * `'host'`.
   */
  pause: (key?: string) => void;
  /** Release one `pause` hold (default key `'host'`). */
  resume: (key?: string) => void;
  /** True while any pause hold is active. */
  isPaused: () => boolean;
  /**
   * The announcement for a toast (its `message` and `politeness`), or for
   * the newest toast without an id. `undefined` when there is none.
   */
  announcement: (id?: string) => ToastAnnouncement | undefined;
};

type Meta = {
  kind: ToastKind;
  action?: ToastOptions['action'];
  onSettle?: ToastOptions['onSettle'];
  pending?: boolean;
  error?: string;
};

type Timer = {
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | undefined;
};

/** Rethrow a callback error outside the store so it reaches host error reporting. */
function report(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}

function announcementFor(
  title: string,
  description: string | undefined,
  tone: 'foreground' | 'background'
): ToastAnnouncement {
  return {
    message: [title, description].filter(Boolean).join('. '),
    politeness: tone === 'foreground' ? 'assertive' : 'polite',
  };
}

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
 * Styled toast API on top of the primitive queue. Visual kind, actions,
 * settle reasons and the auto-dismiss timers (with pause and resume) live
 * here; the primitive owns the R16 viewport and the announcer wiring.
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
        announcement: announcementFor(record.title, record.description, record.tone),
      };
      if (record.description) item.description = record.description;
      if (extra?.action) item.action = extra.action;
      if (extra?.error) item.error = extra.error;
      return item;
    });
  }

  function emit(): void {
    const items = snapshot();
    for (const listener of listeners) listener(items);
  }

  const timers = new Map<string, Timer>();
  /** Reasons recorded just before the store itself removes a toast. */
  const reasons = new Map<string, ToastSettleReason>();
  const holds = new Set<string>();
  /** Toasts whose action is running (a second click does not run it again). */
  const acting = new Set<string>();

  function clearTimer(id: string): void {
    const timer = timers.get(id);
    if (timer?.handle !== undefined) clearTimeout(timer.handle);
    timers.delete(id);
  }

  function armTimer(id: string, timer: Timer): void {
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => {
      timers.delete(id);
      remove(id, 'timeout');
    }, timer.remaining);
  }

  function startTimer(id: string, duration: number): void {
    clearTimer(id);
    if (!(duration > 0) || !Number.isFinite(duration)) return;
    const timer: Timer = { remaining: duration, startedAt: 0, handle: undefined };
    timers.set(id, timer);
    if (holds.size === 0) armTimer(id, timer);
  }

  function pauseTimers(): void {
    for (const timer of timers.values()) {
      if (timer.handle === undefined) continue;
      clearTimeout(timer.handle);
      timer.handle = undefined;
      timer.remaining = Math.max(0, timer.remaining - (Date.now() - timer.startedAt));
    }
  }

  function resumeTimers(): void {
    for (const [id, timer] of timers) {
      if (timer.handle === undefined) armTimer(id, timer);
    }
  }

  function remove(id: string, reason: ToastSettleReason): void {
    if (!meta.has(id)) return;
    reasons.set(id, reason);
    manager.dismiss(id);
    reasons.delete(id);
  }

  // Every way out of the queue passes here: the store's timer and action
  // record their reason first; the close button, a swipe, `dismiss()` and
  // the max cap leave none and settle as 'dismiss'.
  manager.subscribe(() => {
    const live = new Set(manager.list().map((t) => t.id));
    const settled: [NonNullable<Meta['onSettle']>, ToastSettleReason][] = [];
    for (const [id, extra] of meta) {
      if (live.has(id)) continue;
      meta.delete(id);
      clearTimer(id);
      if (extra.onSettle) settled.push([extra.onSettle, reasons.get(id) ?? 'dismiss']);
    }
    emit();
    for (const [onSettle, reason] of settled) {
      try {
        onSettle(reason);
      } catch (error) {
        report(error);
      }
    }
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
      ...(options.onSettle ? { onSettle: options.onSettle } : {}),
      pending: false,
    });
    const record = manager.list().find((item) => item.id === id);
    if (record) {
      startTimer(id, record.duration);
    } else {
      // Pushed out by the max cap at once (lower priority than a full stack).
      meta.delete(id);
      try {
        options.onSettle?.('dismiss');
      } catch (error) {
        report(error);
      }
    }
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
      if (id === undefined) manager.dismissAll();
      else remove(id, 'dismiss');
    },
    async action(id) {
      const extra = meta.get(id);
      const action = extra?.action;
      if (!extra || !action || acting.has(id)) return;
      acting.add(id);
      clearTimer(id);
      if (extra.error !== undefined) {
        delete extra.error;
        emit();
      }
      let failed = false;
      try {
        await action.onClick();
      } catch (error) {
        failed = true;
        report(error);
        // The toast may have left while the action ran (dismissed, pushed out).
        const current = meta.get(id);
        if (action.retryOnError && current === extra) {
          let message = DEFAULT_TOAST_ACTION_ERROR;
          try {
            const text =
              typeof action.errorText === 'function' ? action.errorText(error) : action.errorText;
            if (typeof text === 'string' && text) message = text;
          } catch (textError) {
            report(textError);
          }
          current.error = message;
          const record = manager.list().find((item) => item.id === id);
          if (record) startTimer(id, record.duration);
          emit();
        }
      } finally {
        acting.delete(id);
        if (!(failed && action.retryOnError && meta.get(id) === extra)) remove(id, 'action');
      }
    },
    pause(key = 'host') {
      const wasRunning = holds.size === 0;
      holds.add(key);
      if (wasRunning) pauseTimers();
    },
    resume(key = 'host') {
      if (!holds.delete(key) || holds.size > 0) return;
      resumeTimers();
    },
    isPaused: () => holds.size > 0,
    announcement(id) {
      const records = manager.list();
      const record =
        id === undefined
          ? [...records].sort((a, b) => b.createdAt - a.createdAt)[0]
          : records.find((item) => item.id === id);
      return record ? announcementFor(record.title, record.description, record.tone) : undefined;
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
  action: (id: string) => getToastStore().action(id),
  pause: (key?: string) => getToastStore().pause(key),
  resume: (key?: string) => getToastStore().resume(key),
  announcement: (id?: string) => getToastStore().announcement(id),
  subscribe: (listener: (items: readonly ToastItem[]) => void) =>
    getToastStore().subscribe(listener),
  get items() {
    return getToastStore().items();
  },
  get manager() {
    return getToastStore().manager;
  },
};
