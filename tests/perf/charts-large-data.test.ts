// @vitest-environment node
import { describe, expect, it } from 'vitest';

declare const process: { env: Record<string, string | undefined> };

import {
  SPARKLINE_MAX_POINTS,
  sparklineGeometry,
} from '../../packages/charts/src/compact/shared.ts';
import { createHistogramLayout } from '../../packages/charts/src/histogram/model.ts';
import { lttbIndices } from '../../packages/charts/src/math/index.ts';
import { bin, MAX_BINS } from '../../packages/charts/src/math/shapes/bin.ts';
import {
  createBoxLayout,
  createEcdfLayout,
  createViolinLayout,
} from '../../packages/charts/src/statistical/model.ts';
import { MAX_STAT_VALUES } from '../../packages/charts/src/statistical/stats.ts';
import {
  appendSeriesWindow,
  MAX_STREAM_POINTS,
} from '../../packages/charts/src/streaming/model.ts';
import {
  type ChartWorkerLike,
  createChartOffload,
  handleChartOffload,
} from '../../packages/charts/src/worker/index.ts';

/*
 * Large-data limits for @texuli/charts. Each case asserts an output bound
 * (the DOM-facing size stays fixed however long the input is) and a wall-clock
 * budget calibrated against a native 100k sort on the same machine, so the
 * budget scales with slow CI hosts instead of flaking.
 */

function createRng(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function bestOfThree(work: () => unknown): number {
  work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

async function bestOfThreeAsync(work: () => Promise<unknown>): Promise<number> {
  await work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    await work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

/** A MessageChannel stand-in for a module worker: real structured clone and transfer. */
function channelWorker(): ChartWorkerLike & { close(): void } {
  const channel = new MessageChannel();
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
  channel.port1.start();
  return {
    postMessage: (message, transfer) => channel.port1.postMessage(message, transfer),
    addEventListener: (type: string, listener: (event: never) => void) =>
      channel.port1.addEventListener(type, listener as never),
    close: () => {
      channel.port1.close();
      channel.port2.close();
    },
  };
}

const random = createRng('charts-large-data');
const baselineMs = bestOfThree(() => Float64Array.from({ length: 100_000 }, random).sort());
const budget = (floorMs: number, factor: number) => Math.max(floorMs, factor * baselineMs);
const report = (name: string, ms: number) => {
  if (process.env.TEXULI_PERF_REPORT === '1')
    console.log(`[perf] ${name}: ${ms.toFixed(1)} ms (baseline ${baselineMs.toFixed(1)} ms)`);
};

/** A noisy million-point series with gaps every 997 values. */
const million = Array.from({ length: 1_000_000 }, (_, i) =>
  i % 997 === 0 ? null : Math.sin(i / 500) * 100 + random() * 10
);
const groups = Array.from({ length: 4 }, (_, g) => ({
  id: `g${g}`,
  label: `Group ${g}`,
  values: Array.from({ length: MAX_STAT_VALUES }, () => g * 10 + random() * 50),
}));

describe('charts large-data limits', () => {
  it('draws a 1M-value sparkline from a bounded bucket sample', { timeout: 60_000 }, () => {
    let points = 0;
    const ms = bestOfThree(() => {
      points = sparklineGeometry(million, 'line', 32).points.length;
    });
    expect(points).toBeLessThanOrEqual(SPARKLINE_MAX_POINTS + 1);
    report('sparkline-1m', ms);
    expect(ms).toBeLessThan(budget(400, 40));
  });

  it('bins 1M values into at most MAX_BINS bars', { timeout: 60_000 }, () => {
    let bars = 0;
    const ms = bestOfThree(() => {
      bars = createHistogramLayout(million, { count: 1e9 }).bars.length;
    });
    expect(bars).toBeLessThanOrEqual(MAX_BINS);
    report('histogram-1m', ms);
    expect(ms).toBeLessThan(budget(400, 30));
  });

  it('summarizes four 100k groups as box, violin and ECDF layouts', { timeout: 60_000 }, () => {
    let longestPath = 0;
    const ms = bestOfThree(() => {
      createBoxLayout(groups);
      const violin = createViolinLayout(groups);
      const ecdf = createEcdfLayout(groups);
      longestPath = Math.max(...[...violin.marks, ...ecdf.marks].map((mark) => mark.path.length));
    });
    // The ECDF path holds one step per distinct value (up to 100k), so it is
    // the one geometry that grows with input; it stays under ~4 MB.
    expect(longestPath).toBeLessThan(4_000_000);
    report('statistical-4x100k', ms);
    expect(ms).toBeLessThan(budget(1_000, 80));
  });

  it('downsamples 1M points to a 2k LTTB sample', { timeout: 60_000 }, () => {
    const xs = Float64Array.from({ length: 1_000_000 }, (_, i) => i);
    const ys = Float64Array.from(million, (value) => value ?? 0);
    let picked = 0;
    const ms = bestOfThree(() => {
      picked = lttbIndices(xs, ys, 2_000).length;
    });
    expect(picked).toBe(2_000);
    report('lttb-1m', ms);
    expect(ms).toBeLessThan(budget(150, 15));
  });

  it('appends 1k batches to a bounded streaming window', { timeout: 60_000 }, () => {
    const batches = Array.from({ length: 1_000 }, (_, b) => [
      {
        id: 's',
        label: 'Stream',
        points: Array.from({ length: 100 }, (_, i) => ({ x: b * 100 + i, y: random() })),
      },
    ]);
    let size = 0;
    const ms = bestOfThree(() => {
      let current = [{ id: 's', label: 'Stream', points: [] as { x: number; y: number }[] }];
      for (const batch of batches) {
        current = appendSeriesWindow(current, batch, { maxPoints: 10_000 }) as typeof current;
      }
      size = current[0]?.points.length ?? 0;
    });
    expect(size).toBe(10_000);
    expect(size).toBeLessThanOrEqual(MAX_STREAM_POINTS);
    report('streaming-1k-batches', ms);
    expect(ms).toBeLessThan(budget(500, 40));
  });

  it('offloads binning and LTTB of 1M values with results identical to the sync path', {
    timeout: 60_000,
  }, async () => {
    const worker = channelWorker();
    const offload = createChartOffload({ createWorker: () => worker });
    const xs = Array.from({ length: million.length }, (_, i) => i);
    try {
      const sync = bin(million, { count: 200 });
      expect(await offload.bin(million, { count: 200 })).toEqual(sync);
      expect(offload.mode).toBe('worker');
      const ms = await bestOfThreeAsync(async () => {
        await Promise.all([offload.bin(million, { count: 200 }), offload.lttb(xs, million, 2_000)]);
      });
      report('offload-1m-bin-lttb', ms);
      // Packing to Float64Array and the transfer must stay a small multiple of the work itself.
      expect(ms).toBeLessThan(budget(800, 60));
    } finally {
      offload.dispose();
      worker.close();
    }
  });

  it('falls back to the main thread for 1M values without a worker', {
    timeout: 60_000,
  }, async () => {
    const offload = createChartOffload();
    let bars = 0;
    const ms = await bestOfThreeAsync(async () => {
      bars = (await offload.bin(million, { count: 200 })).length;
    });
    report('offload-fallback-1m-bin', ms);
    expect(offload.mode).toBe('main-thread');
    expect(bars).toBeGreaterThan(0);
    expect(ms).toBeLessThan(budget(500, 40));
  });
});
