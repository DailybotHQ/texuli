// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { lttbIndices } from '../src/math/downsample/lttb.ts';
import { minMaxBuckets } from '../src/math/downsample/min-max.ts';
import { bin } from '../src/math/shapes/bin.ts';
import {
  type ChartWorkerLike,
  createChartOffload,
  handleChartOffload,
  packBins,
  toFloat64,
  unpackBins,
} from '../src/worker/index.ts';

/*
 * The offload runs in the node environment on purpose: the contract needs no
 * DOM. A MessageChannel stands in for the worker, so requests and responses
 * really structured-clone and transfer their buffers.
 */

const ports: { close(): void }[] = [];
afterEach(() => {
  for (const port of ports.splice(0)) port.close();
});

/** A worker made of a MessageChannel whose far end runs the real handler. */
function channelWorker(log: { posts: number; transferred: number }): ChartWorkerLike {
  const channel = new MessageChannel();
  ports.push(channel.port1, channel.port2);
  channel.port2.onmessage = (event: MessageEvent) => {
    const response = handleChartOffload(event.data);
    const buffers =
      'bins' in response
        ? [response.bins.buffer]
        : 'indices' in response
          ? [response.indices.buffer]
          : [];
    channel.port2.postMessage(response, buffers as ArrayBuffer[]);
  };
  const port = channel.port1;
  port.start();
  return {
    postMessage(message, transfer) {
      log.posts++;
      log.transferred += transfer.length;
      port.postMessage(message, transfer);
    },
    addEventListener(type: string, listener: (event: never) => void) {
      port.addEventListener(type, listener as never);
    },
    close: () => port.close(),
  };
}

const values = Array.from({ length: 2_000 }, (_, i) =>
  i % 101 === 0 ? null : Math.sin(i / 40) * 50 + (i % 7)
);
const xs = values.map((_, i) => i);

describe('chart offload contract', () => {
  it('packs bins and gaps losslessly; reports bad requests as errors instead of throwing', () => {
    {
      // packs bins and gaps losslessly
      const bins = bin(values, { count: 12 });
      expect(unpackBins(packBins(bins))).toEqual(bins);
      expect(Array.from(toFloat64([1, null, 3]))).toEqual([1, Number.NaN, 3]);
    }
    // reports bad requests as errors instead of throwing
    expect(handleChartOffload({ id: 7, op: 'nope' } as never)).toMatchObject({ id: 7, ok: false });
  });
});

describe('createChartOffload', () => {
  it('runs on the main thread without a worker factory, matching the sync math exactly, and 5 related cases', async () => {
    // runs on the main thread without a worker factory, matching the sync math exactly
    await (async () => {
      const offload = createChartOffload();
      expect(offload.mode).toBe('main-thread');
      expect(await offload.bin(values, { count: 20 })).toEqual(bin(values, { count: 20 }));
      const ys = toFloat64(values);
      expect(await offload.lttb(xs, values, 300)).toEqual(lttbIndices(xs, ys, 300));
      expect(await offload.minMax(xs, values, 50)).toEqual(minMaxBuckets(xs, ys, { buckets: 50 }));
    })();
    // offloads to a worker with transferred buffers and identical results
    await (async () => {
      const log = { posts: 0, transferred: 0 };
      const offload = createChartOffload({
        createWorker: () => channelWorker(log),
        minOffloadLength: 0,
      });
      expect(offload.mode).toBe('worker');
      const [bins, sampled, buckets] = await Promise.all([
        offload.bin(values, { count: 20 }),
        offload.lttb(xs, values, 300),
        offload.minMax(xs, values, 50),
      ]);
      const ys = toFloat64(values);
      expect(bins).toEqual(bin(values, { count: 20 }));
      expect(sampled).toEqual(lttbIndices(xs, ys, 300));
      expect(buckets).toEqual(minMaxBuckets(xs, ys, { buckets: 50 }));
      expect(log.posts).toBe(3);
      // bin hands over one buffer; lttb and min-max hand over xs and ys.
      expect(log.transferred).toBe(5);
      offload.dispose();
      expect(offload.mode).toBe('main-thread');
    })();
    // keeps small inputs on the main thread
    await (async () => {
      const log = { posts: 0, transferred: 0 };
      const offload = createChartOffload({ createWorker: () => channelWorker(log) });
      await offload.bin([1, 2, 3]);
      expect(log.posts).toBe(0);
      offload.dispose();
    })();
    // falls back to the main thread when the worker errors, finishing calls in flight
    await (async () => {
      let fireError: (event: unknown) => void = () => {};
      const silent: ChartWorkerLike = {
        postMessage() {
          // Never answers; reports an error instead.
          queueMicrotask(() => fireError(new Error('worker crashed')));
        },
        addEventListener(type: string, listener: (event: never) => void) {
          if (type === 'error') fireError = listener as (event: unknown) => void;
        },
        terminate() {},
      };
      const offload = createChartOffload({ createWorker: () => silent, minOffloadLength: 0 });
      expect(await offload.bin(values, { count: 10 })).toEqual(bin(values, { count: 10 }));
      expect(offload.mode).toBe('main-thread');
      expect(await offload.lttb(xs, values, 100)).toEqual(lttbIndices(xs, toFloat64(values), 100));
    })();
    // falls back when the worker cannot be created (SSR, blocked workers)
    await (async () => {
      const offload = createChartOffload({
        createWorker: () => {
          throw new Error('Worker is not defined');
        },
        minOffloadLength: 0,
      });
      expect(await offload.bin(values)).toEqual(bin(values));
      expect(offload.mode).toBe('main-thread');
    })();
    {
      // accepts a DOM Worker as a ChartWorkerLike (type-level check)
      const accept = (worker: Worker): ChartWorkerLike => worker;
      expect(typeof accept).toBe('function');
    }
  });
});

describe('worker entry', () => {
  it('answers requests in a worker scope and transfers the result back', async () => {
    const scope = globalThis as unknown as Record<string, unknown>;
    let onMessage: ((event: { data: unknown }) => void) | undefined;
    const posted: { message: unknown; transfer: ArrayBuffer[] }[] = [];
    const saved = { addEventListener: scope.addEventListener, postMessage: scope.postMessage };
    scope.addEventListener = (type: string, listener: (event: { data: unknown }) => void) => {
      if (type === 'message') onMessage = listener;
    };
    scope.postMessage = (message: unknown, transfer: ArrayBuffer[]) =>
      posted.push({ message, transfer });
    try {
      await import('../src/worker/entry.ts');
      expect(onMessage).toBeTypeOf('function');
      onMessage?.({ data: { id: 3, op: 'bin', values: toFloat64(values), options: { count: 8 } } });
      expect(posted).toHaveLength(1);
      const response = posted[0]?.message as { id: number; ok: boolean; bins: Float64Array };
      expect(response).toMatchObject({ id: 3, ok: true });
      expect(unpackBins(response.bins)).toEqual(bin(values, { count: 8 }));
      expect(posted[0]?.transfer).toEqual([response.bins.buffer]);
    } finally {
      scope.addEventListener = saved.addEventListener;
      scope.postMessage = saved.postMessage;
    }
  });
});
