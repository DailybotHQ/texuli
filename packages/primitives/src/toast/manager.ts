import {
  PRIORITY_RANK,
  type ToastManager,
  type ToastManagerOptions,
  type ToastRecord,
} from './types.ts';

let seq = 0;

function defaultId(): string {
  seq += 1;
  return `toast-${seq}`;
}

function sortToasts(items: ToastRecord[]): ToastRecord[] {
  return [...items].sort((a, b) => {
    const rank = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (rank !== 0) return rank;
    return b.createdAt - a.createdAt;
  });
}

/**
 * Framework-free toast queue. Priority ordering, publish/dismiss, and a
 * subscribe hook for the viewport. Timers live in the Svelte toast item.
 */
export function createToastManager(options: ToastManagerOptions = {}): ToastManager {
  const max = Math.max(1, options.max ?? 20);
  const defaultDuration = options.duration ?? 5000;
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? defaultId;

  let items: ToastRecord[] = [];
  const listeners = new Set<(toasts: readonly ToastRecord[]) => void>();

  function emit(): void {
    const snapshot = items.slice();
    for (const listener of listeners) listener(snapshot);
  }

  return {
    list: () => items.slice(),
    subscribe(listener) {
      listeners.add(listener);
      listener(items.slice());
      return () => {
        listeners.delete(listener);
      };
    },
    publish(input) {
      const id =
        typeof input.id === 'string' && input.id.trim() !== '' ? input.id.trim() : createId();
      const title = typeof input.title === 'string' ? input.title : '';
      const description = typeof input.description === 'string' ? input.description : '';
      const duration =
        typeof input.duration === 'number' && Number.isFinite(input.duration)
          ? Math.max(0, input.duration)
          : defaultDuration;
      const priority =
        input.priority === 'high' || input.priority === 'low' ? input.priority : 'normal';
      const tone = input.tone === 'foreground' ? 'foreground' : 'background';

      // The new record goes first: the sort is stable, so toasts published in
      // the same millisecond still list newest first, deterministically.
      items = sortToasts([
        {
          id,
          title,
          description,
          duration,
          priority,
          tone,
          createdAt: now(),
        },
        ...items.filter((item) => item.id !== id),
      ]).slice(0, max);
      emit();
      return id;
    },
    dismiss(id) {
      const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) return;
      items = next;
      emit();
    },
    dismissAll() {
      if (items.length === 0) return;
      items = [];
      emit();
    },
  };
}
