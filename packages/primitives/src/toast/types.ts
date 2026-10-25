/** Toast priority — higher values surface first when the viewport is full. */
export type ToastPriority = 'low' | 'normal' | 'high';

/** Live-region politeness for the toast announcement. */
export type ToastTone = 'foreground' | 'background';

export type ToastRecord = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Auto-dismiss duration in ms. `0` or `Infinity` = sticky. */
  readonly duration: number;
  readonly priority: ToastPriority;
  readonly tone: ToastTone;
  readonly createdAt: number;
};

export type PublishToastInput = {
  id?: string;
  title?: string;
  description?: string;
  duration?: number;
  priority?: ToastPriority;
  tone?: ToastTone;
};

export type ToastManagerOptions = {
  /** Max toasts kept in the queue (default 20). */
  max?: number;
  /** Default duration ms (default 5000). */
  duration?: number;
  /** Injected clock for tests. */
  now?: () => number;
  /** Id factory for tests. */
  createId?: () => string;
};

export type ToastManager = {
  /** Snapshot of queued toasts, highest priority first then newest. */
  list: () => readonly ToastRecord[];
  /** Subscribe to queue changes. Returns unsubscribe. */
  subscribe: (listener: (toasts: readonly ToastRecord[]) => void) => () => void;
  publish: (input: PublishToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

export const PRIORITY_RANK: Record<ToastPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};
