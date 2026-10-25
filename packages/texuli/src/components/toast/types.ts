/** Visual tone for a styled toast. */
export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type ToastAction = {
  label: string;
  onClick: () => void | Promise<void>;
};

export type ToastOptions = {
  description?: string;
  /** Milliseconds before auto-dismiss. `0` or `Infinity` keeps the toast until dismissed. */
  duration?: number;
  /** Reuse an id to replace an existing toast (e.g. loading → success). */
  id?: string;
  action?: ToastAction;
};

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
  action?: ToastAction;
  /** True while a promise toast is pending. */
  pending?: boolean;
  /** From the primitive queue (for Root binding). */
  createdAt: number;
  priority: 'low' | 'normal' | 'high';
  tone: 'foreground' | 'background';
};

export type PromiseToastMessages = {
  loading: string;
  success: string | ((value: unknown) => string);
  error: string | ((error: unknown) => string);
  loadingDescription?: string;
  successDescription?: string | ((value: unknown) => string | undefined);
  errorDescription?: string | ((error: unknown) => string | undefined);
};

export const DEFAULT_TOAST_DURATION: Record<ToastKind, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 8000,
};

/** Cap so the stack never covers the whole screen. */
export const MAX_TOASTS = 5;
