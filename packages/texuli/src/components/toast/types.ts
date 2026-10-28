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
  /**
   * Called exactly once when the toast leaves: `'timeout'` when its timer ran
   * out, `'action'` after its action ran, `'dismiss'` for every other way out
   * (the close button, a swipe, `dismiss()`, or being pushed out of the stack
   * by newer toasts). Undo pattern: commit on `'timeout'` and `'dismiss'`,
   * revert on `'action'`. Replacing a toast by `id` keeps one toast: only the
   * newest `onSettle` is called.
   */
  onSettle?: (reason: ToastSettleReason) => void;
};

/** Why a toast left the stack (see `ToastOptions.onSettle`). */
export type ToastSettleReason = 'timeout' | 'dismiss' | 'action';

/** What the screen reader hears for a toast, and how urgently. */
export type ToastAnnouncement = {
  /** `title` and `description` joined with `. ` (the announced text). */
  message: string;
  /** `assertive` for errors, `polite` for every other kind. */
  politeness: 'polite' | 'assertive';
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
  /** The announcement the region speaks for this toast. */
  announcement: ToastAnnouncement;
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
