import { getOwnerDocument, getOwnerWindow } from '@texuli/core/env';

/**
 * Shared helpers for layout chrome: storage keys, navigate listeners,
 * and closing drawers when the host grows past a breakpoint.
 */

/**
 * localStorage key for a layout's persisted UI state, scoped by the host's
 * `storageKey` (app namespace) or the page path.
 */
export function layoutStorageKey(name: string, storageKey?: string): string {
  let scope = storageKey ?? '';
  if (!scope) {
    try {
      if (typeof location !== 'undefined') scope = location.pathname;
    } catch {
      scope = '';
    }
  }
  return `texuli:layout:${scope}:${name}`;
}

/** Reads a stored boolean; private windows and blocked storage fall back. */
export function readFlag(key: string, fallback: boolean): boolean {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

/** Stores a boolean; failures are ignored. */
export function writeFlag(key: string, value: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Storage is a convenience, never required.
  }
}

/**
 * Calls `close` once `element` is at least `minWidth` px wide.
 * Returns a cleanup function.
 */
export function closeWhenWide(
  element: HTMLElement | undefined,
  minWidth: number,
  close: () => void
): () => void {
  if (!element) return () => {};
  const win = getOwnerWindow(element);
  const RO =
    (win as (Window & { ResizeObserver?: typeof ResizeObserver }) | undefined)?.ResizeObserver ??
    globalThis.ResizeObserver;
  if (typeof RO !== 'function') return () => {};
  const observer = new RO((entries: ResizeObserverEntry[]) => {
    const entry = entries[0];
    if (entry && entry.contentRect.width >= minWidth) close();
  });
  observer.observe(element);
  return () => observer.disconnect();
}

/**
 * Run `callback` on in-app hash or history navigation. Returns cleanup.
 * No `window` access at import time.
 */
export function onNavigate(callback: () => void, node?: Node | null): () => void {
  const doc =
    getOwnerDocument(node ?? null) ?? (typeof document !== 'undefined' ? document : undefined);
  const win = doc?.defaultView;
  if (!win) return () => {};
  const handler = () => callback();
  win.addEventListener('hashchange', handler);
  win.addEventListener('popstate', handler);
  return () => {
    win.removeEventListener('hashchange', handler);
    win.removeEventListener('popstate', handler);
  };
}
