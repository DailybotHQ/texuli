import { getContext, setContext } from 'svelte';
import type { ToastManager, ToastRecord } from './types.ts';

export const TOAST_PROVIDER_CONTEXT = Symbol('texuli-toast-provider');
export const TOAST_ITEM_CONTEXT = Symbol('texuli-toast-item');
export const TOAST_VIEWPORT_CONTEXT = Symbol('texuli-toast-viewport');

export type ToastProviderContext = {
  manager: ToastManager;
  label: string;
  hotkey: string;
  /** Pause all item timers (hover/focus on viewport). */
  pauseAll: () => void;
  resumeAll: () => void;
  isPaused: () => boolean;
  registerPauser: (fn: (paused: boolean) => void) => () => void;
  /** Focus the first actionable control in the viewport (F6). */
  focusRegion: () => void;
  setFocusHandler: (fn: (() => void) | null) => void;
};

export type ToastItemContext = {
  toast: ToastRecord;
  dismiss: () => void;
};

export type ToastViewportContext = {
  element: () => HTMLElement | null;
};

export function setToastProviderContext(value: ToastProviderContext): void {
  setContext(TOAST_PROVIDER_CONTEXT, value);
}

export function getToastProviderContext(): ToastProviderContext {
  const ctx = getContext<ToastProviderContext | undefined>(TOAST_PROVIDER_CONTEXT);
  if (!ctx) throw new Error('Toast parts must be used inside Toast.Provider');
  return ctx;
}

export function setToastItemContext(value: ToastItemContext): void {
  setContext(TOAST_ITEM_CONTEXT, value);
}

export function getToastItemContext(): ToastItemContext {
  const ctx = getContext<ToastItemContext | undefined>(TOAST_ITEM_CONTEXT);
  if (!ctx) throw new Error('Toast.Title/Description/Action/Close require Toast.Root');
  return ctx;
}

export function setToastViewportContext(value: ToastViewportContext): void {
  setContext(TOAST_VIEWPORT_CONTEXT, value);
}

export function getToastViewportContext(): ToastViewportContext | undefined {
  return getContext<ToastViewportContext | undefined>(TOAST_VIEWPORT_CONTEXT);
}
