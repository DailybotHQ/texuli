import { lttbIndices } from '../math/downsample/lttb.ts';
import { minMaxBuckets } from '../math/downsample/min-max.ts';
import { type Bin, bin } from '../math/shapes/bin.ts';
import type { ChartOffloadRequest, ChartOffloadResponse } from './protocol.ts';

/*
 * Runs one offload request with the synchronous chart math. The worker entry
 * and the main-thread fallback both call this, so the two paths return the
 * same bins and indices by construction.
 */

export function packBins(bins: readonly Bin[]): Float64Array {
  const out = new Float64Array(bins.length * 3);
  bins.forEach((item, i) => {
    out[i * 3] = item.x0;
    out[i * 3 + 1] = item.x1;
    out[i * 3 + 2] = item.count;
  });
  return out;
}

export function unpackBins(packed: Float64Array): Bin[] {
  const bins: Bin[] = [];
  for (let i = 0; i + 2 < packed.length; i += 3) {
    bins.push({
      x0: packed[i] as number,
      x1: packed[i + 1] as number,
      count: packed[i + 2] as number,
    });
  }
  return bins;
}

/** `null` gaps become NaN, which `bin` and the downsamplers skip the same way. */
export function toFloat64(values: ArrayLike<number | null>): Float64Array {
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    out[i] = typeof value === 'number' ? value : Number.NaN;
  }
  return out;
}

export function handleChartOffload(request: ChartOffloadRequest): ChartOffloadResponse {
  const id = request?.id ?? -1;
  try {
    switch (request.op) {
      case 'bin': {
        // `bin` reads `(number | null)[]`; NaN is non-finite and is skipped like null.
        const bins = bin(request.values as unknown as readonly number[], request.options ?? {});
        return { id, ok: true, op: 'bin', bins: packBins(bins) };
      }
      case 'lttb':
        return {
          id,
          ok: true,
          op: 'lttb',
          indices: Uint32Array.from(lttbIndices(request.xs, request.ys, request.threshold)),
        };
      case 'min-max':
        return {
          id,
          ok: true,
          op: 'min-max',
          indices: Uint32Array.from(
            minMaxBuckets(request.xs, request.ys, { buckets: request.buckets })
          ),
        };
      default:
        return { id, ok: false, error: 'Unknown chart offload operation.' };
    }
  } catch (error) {
    return { id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
