import type { Bin, BinOptions } from '../math/shapes/bin.ts';
import { handleChartOffload, toFloat64, unpackBins } from './handler.ts';
import { type ChartOffloadRequest, type ChartOffloadResponse, transferables } from './protocol.ts';

/*
 * Opt-in worker offload for binning and downsampling very large series.
 * Nothing here starts a worker by itself: the host passes a factory that
 * creates one from `@texuli/charts/worker/entry` with its own bundler. With no
 * factory, without a `Worker` (SSR, tests) or after a worker error, every call
 * runs the same handler on the main thread, so results never differ.
 */

/** The slice of a Worker (or MessagePort) the client uses; no DOM types required. */
export interface ChartWorkerLike {
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'error' | 'messageerror', listener: (event: unknown) => void): void;
  terminate?(): void;
  close?(): void;
}

export interface ChartOffloadOptions {
  /** Creates the worker, e.g. `() => new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), { type: 'module' })`. */
  createWorker?: (() => ChartWorkerLike) | undefined;
  /**
   * Below this many input values a call runs synchronously, because posting
   * costs more than the work (default 50,000).
   */
  minOffloadLength?: number;
}

export type ChartOffloadMode = 'worker' | 'main-thread';

export interface ChartOffload {
  /** Where the next large call runs; `main-thread` once a worker has failed. */
  readonly mode: ChartOffloadMode;
  bin(values: ArrayLike<number | null>, options?: BinOptions): Promise<Bin[]>;
  lttb(xs: ArrayLike<number>, ys: ArrayLike<number | null>, threshold: number): Promise<number[]>;
  minMax(xs: ArrayLike<number>, ys: ArrayLike<number | null>, buckets: number): Promise<number[]>;
  /** Stops the worker; later calls run on the main thread. */
  dispose(): void;
}

/** Default length below which offloading is not worth a message round trip. */
export const DEFAULT_MIN_OFFLOAD_LENGTH = 50_000;

type Pending = {
  request: ChartOffloadRequest;
  resolve: (response: ChartOffloadResponse) => void;
};

export function createChartOffload(options: ChartOffloadOptions = {}): ChartOffload {
  const minLength =
    typeof options.minOffloadLength === 'number' && options.minOffloadLength >= 0
      ? options.minOffloadLength
      : DEFAULT_MIN_OFFLOAD_LENGTH;
  let worker: ChartWorkerLike | null = null;
  let failed = false;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  const fail = () => {
    failed = true;
    stop();
    // Requests in flight lost their buffers to the transfer; their copies are rerun here.
    for (const [id, item] of pending) {
      pending.delete(id);
      item.resolve(handleChartOffload(item.request));
    }
  };

  function stop() {
    worker?.terminate?.();
    worker?.close?.();
    worker = null;
  }

  function ensureWorker(): ChartWorkerLike | null {
    if (failed || !options.createWorker) return null;
    if (worker) return worker;
    try {
      const created = options.createWorker();
      created.addEventListener('message', (event) => {
        const response = event.data as ChartOffloadResponse;
        const item = pending.get(response?.id);
        if (!item) return;
        pending.delete(response.id);
        item.resolve(response);
      });
      created.addEventListener('error', fail);
      created.addEventListener('messageerror', fail);
      worker = created;
      return worker;
    } catch {
      failed = true;
      return null;
    }
  }

  function run(request: ChartOffloadRequest, length: number): Promise<ChartOffloadResponse> {
    const target = length >= minLength ? ensureWorker() : null;
    if (!target) return Promise.resolve(handleChartOffload(request));
    // Keep a private copy so a failed worker can be replaced by the main thread.
    const copy = cloneRequest(request);
    return new Promise((resolve) => {
      pending.set(request.id, { request: copy, resolve });
      try {
        target.postMessage(request, transferables(request));
      } catch {
        fail();
      }
    });
  }

  const unwrap = <T>(
    response: ChartOffloadResponse,
    pick: (ok: ChartOffloadResponse & { ok: true }) => T
  ): T => {
    if (!response.ok) throw new Error(response.error);
    return pick(response);
  };

  return {
    get mode() {
      return failed || !options.createWorker ? 'main-thread' : 'worker';
    },
    async bin(values, binOptions = {}) {
      const request: ChartOffloadRequest = {
        id: nextId++,
        op: 'bin',
        values: toFloat64(values),
        options: { ...binOptions },
      };
      const response = await run(request, values.length);
      return unwrap(response, (ok) => (ok.op === 'bin' ? unpackBins(ok.bins) : []));
    },
    async lttb(xs, ys, threshold) {
      const request: ChartOffloadRequest = {
        id: nextId++,
        op: 'lttb',
        xs: Float64Array.from(xs),
        ys: toFloat64(ys),
        threshold,
      };
      const response = await run(request, xs.length);
      return unwrap(response, (ok) => (ok.op === 'bin' ? [] : Array.from(ok.indices)));
    },
    async minMax(xs, ys, buckets) {
      const request: ChartOffloadRequest = {
        id: nextId++,
        op: 'min-max',
        xs: Float64Array.from(xs),
        ys: toFloat64(ys),
        buckets,
      };
      const response = await run(request, xs.length);
      return unwrap(response, (ok) => (ok.op === 'bin' ? [] : Array.from(ok.indices)));
    },
    dispose() {
      failed = true;
      stop();
      for (const [id, item] of pending) {
        pending.delete(id);
        item.resolve(handleChartOffload(item.request));
      }
    },
  };
}

function cloneRequest(request: ChartOffloadRequest): ChartOffloadRequest {
  switch (request.op) {
    case 'bin':
      return { ...request, values: request.values.slice(), options: { ...request.options } };
    case 'lttb':
    case 'min-max':
      return { ...request, xs: request.xs.slice(), ys: request.ys.slice() };
  }
}
