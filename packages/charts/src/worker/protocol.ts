import type { BinOptions } from '../math/shapes/bin.ts';

/*
 * The message contract between `createChartOffload` and the worker entry.
 * Plain data and typed arrays only, so it structured-clones and transfers
 * between any two realms; it names no DOM type.
 *
 * Gaps travel as NaN inside Float64Array buffers (`null` in the sync API).
 */

/** The work a worker can take: the same functions as the synchronous math. */
export type ChartOffloadRequest =
  | { id: number; op: 'bin'; values: Float64Array; options: BinOptions }
  | { id: number; op: 'lttb'; xs: Float64Array; ys: Float64Array; threshold: number }
  | { id: number; op: 'min-max'; xs: Float64Array; ys: Float64Array; buckets: number };

export type ChartOffloadResponse =
  | {
      id: number;
      ok: true;
      op: 'bin';
      /** `[x0, x1, count]` per bin, flattened. */
      bins: Float64Array;
    }
  | { id: number; ok: true; op: 'lttb' | 'min-max'; indices: Uint32Array }
  | { id: number; ok: false; error: string };

/** The buffers a message hands over instead of copying. */
export function transferables(message: ChartOffloadRequest | ChartOffloadResponse): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  const add = (view: ArrayBufferView) => {
    if (view.buffer instanceof ArrayBuffer && !out.includes(view.buffer)) out.push(view.buffer);
  };
  if ('op' in message && 'values' in message) add(message.values);
  if ('xs' in message) add(message.xs);
  if ('ys' in message) add(message.ys);
  if ('bins' in message) add(message.bins);
  if ('indices' in message) add(message.indices);
  return out;
}
