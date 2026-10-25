import type { ExportPngOptions, ExportPngResult } from './png.ts';
import type { ExportSvgOptions, ExportSvgResult } from './svg.ts';
import type { ExportWebmOptions, ExportWebmResult } from './webm.ts';

export type ExportQueueItem =
  | { format: 'svg'; input: unknown; options?: ExportSvgOptions }
  | { format: 'png'; input: unknown; options?: Omit<ExportPngOptions, 'signal'> }
  | {
      format: 'webm';
      composition: unknown;
      animation: unknown;
      options?: Omit<ExportWebmOptions, 'signal' | 'onProgress'>;
    };

export type ExportQueueStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/** Progress receipt for one export. It intentionally contains no input or caller-supplied data. */
export interface ExportQueueReceipt {
  readonly id: string;
  readonly format: ExportQueueItem['format'];
  readonly status: ExportQueueStatus;
  readonly progress: number;
  readonly durationMs?: number;
  readonly reason?:
    | 'invalid'
    | 'unsupported'
    | 'aborted'
    | 'tainted'
    | 'encode-failed'
    | 'recorder-failed'
    | 'failed';
}

/** Immutable queue snapshot delivered after each state or progress change. */
export interface ExportQueueProgress {
  readonly completed: number;
  readonly total: number;
  readonly progress: number;
  readonly current: ExportQueueReceipt | null;
  readonly receipts: readonly ExportQueueReceipt[];
}

export type ExportQueueItemResult = ExportSvgResult | ExportPngResult | ExportWebmResult | null;

export interface ExportQueueOptions {
  /** Abort queued work and the current WebM/PNG operation. */
  signal?: AbortSignal;
  /** Receives safe receipt snapshots; callback errors do not interrupt exports. */
  onProgress?: (event: ExportQueueProgress) => void;
  /** Monotonic clock in milliseconds, injectable for deterministic callers and tests. */
  now?: () => number;
}

export interface ExportQueueResult {
  receipts: readonly ExportQueueReceipt[];
  /** Results align with the input jobs; cancelled before start is `null`. */
  results: readonly ExportQueueItemResult[];
}

function normalizedTime(now: () => number): number {
  try {
    const value = now();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function failureReason(result: ExportQueueItemResult): ExportQueueReceipt['reason'] {
  if (!result || result.ok) return undefined;
  if (result.reason === 'invalid') return 'invalid';
  if (result.reason === 'unsupported') return 'unsupported';
  if (result.reason === 'aborted') return 'aborted';
  if (result.reason === 'tainted') return 'tainted';
  if (result.reason === 'encode-failed') return 'encode-failed';
  if (result.reason === 'recorder-failed') return 'recorder-failed';
  return 'failed';
}

function receiptSnapshot(receipt: ExportQueueReceipt): ExportQueueReceipt {
  return Object.freeze({ ...receipt });
}

/**
 * Run independent exports in order and return one privacy-safe progress receipt
 * per item. Failures are recorded and do not prevent later items from running.
 */
export async function exportQueue(
  items: readonly ExportQueueItem[],
  options: ExportQueueOptions = {}
): Promise<ExportQueueResult> {
  const now =
    options.now ?? (() => (typeof performance === 'undefined' ? Date.now() : performance.now()));
  const receipts: ExportQueueReceipt[] = items.map((item, index) => ({
    id: `export-${index + 1}`,
    format: item.format,
    status: 'queued',
    progress: 0,
  }));
  const results: ExportQueueItemResult[] = items.map(() => null);
  let completed = 0;
  let activeIndex: number | null = null;

  const emit = (index: number | null): void => {
    if (!options.onProgress) return;
    const currentReceipt = index === null ? null : (receipts[index] ?? null);
    const current = currentReceipt ? receiptSnapshot(currentReceipt) : null;
    const progress =
      items.length === 0
        ? 1
        : Math.min(
            1,
            (completed + (current?.status === 'running' ? current.progress : 0)) / items.length
          );
    try {
      options.onProgress(
        Object.freeze({
          completed,
          total: items.length,
          progress,
          current,
          receipts: Object.freeze(receipts.map(receiptSnapshot)),
        })
      );
    } catch {
      // Observers cannot turn a successful export into a failed one.
    }
  };

  const update = (index: number, patch: Partial<ExportQueueReceipt>): void => {
    const current = receipts[index];
    if (!current) return;
    receipts[index] = { ...current, ...patch };
    emit(index);
  };

  emit(null);
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item) continue;
    if (options.signal?.aborted) {
      update(index, { status: 'cancelled', reason: 'aborted' });
      completed += 1;
      emit(index);
      continue;
    }

    activeIndex = index;
    const startedAt = normalizedTime(now);
    const controller = new AbortController();
    const abortCurrent = () => controller.abort();
    options.signal?.addEventListener('abort', abortCurrent, { once: true });
    update(index, { status: 'running' });
    let lastProgress = 0;
    const reportProgress = (progress: number): void => {
      if (!Number.isFinite(progress)) return;
      lastProgress = Math.max(lastProgress, Math.min(1, progress));
      update(index, { progress: lastProgress });
    };

    let result: ExportQueueItemResult = null;
    try {
      if (item.format === 'svg') {
        const { exportSvg } = await import('./svg.ts');
        if (!controller.signal.aborted) result = exportSvg(item.input, item.options);
      } else if (item.format === 'png') {
        const { exportPng } = await import('./png.ts');
        if (!controller.signal.aborted)
          result = await exportPng(item.input, { ...item.options, signal: controller.signal });
      } else {
        const { exportWebm } = await import('./webm.ts');
        if (!controller.signal.aborted)
          result = await exportWebm(item.composition, item.animation, {
            ...item.options,
            signal: controller.signal,
            onProgress: reportProgress,
          });
      }
    } catch {
      result = null;
    } finally {
      options.signal?.removeEventListener('abort', abortCurrent);
    }

    results[index] = result;
    const aborted =
      controller.signal.aborted || options.signal?.aborted || failureReason(result) === 'aborted';
    const reason = failureReason(result);
    const status: ExportQueueStatus = aborted ? 'cancelled' : result?.ok ? 'succeeded' : 'failed';
    if (result?.ok) reportProgress(1);
    const endedAt = normalizedTime(now);
    completed += 1;
    update(index, {
      status,
      progress: status === 'succeeded' ? 1 : lastProgress,
      durationMs: Math.max(0, endedAt - startedAt),
      ...(aborted
        ? { reason: 'aborted' as const }
        : reason
          ? { reason }
          : status === 'failed'
            ? { reason: 'failed' as const }
            : {}),
    });
    activeIndex = null;
  }

  if (activeIndex !== null) emit(activeIndex);
  return {
    receipts: Object.freeze(receipts.map(receiptSnapshot)),
    results: Object.freeze(results),
  };
}
