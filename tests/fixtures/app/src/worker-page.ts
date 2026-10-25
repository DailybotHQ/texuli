import { lttbIndices, minMaxBuckets } from '@texuli/charts/math/downsample';
import { bin } from '@texuli/charts/math/shapes';
import { type ChartWorkerLike, createChartOffload, toFloat64 } from '@texuli/charts/worker';

/*
 * tests/e2e/charts-worker.spec.ts: runs the offload in a REAL module worker
 * created with the documented host pattern, then with a constructor that
 * throws, and publishes whether every result equals the synchronous math.
 */

const values = Array.from({ length: 60_000 }, (_, i) =>
  i % 211 === 0 ? null : Math.sin(i / 300) * 80 + ((i * 7919) % 13)
);
const xs = values.map((_, i) => i);
const ys = toFloat64(values);
const sync = {
  bins: bin(values, { count: 40 }),
  lttb: lttbIndices(xs, ys, 500),
  minMax: minMaxBuckets(xs, ys, { buckets: 120 }),
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function run(createWorker: () => ChartWorkerLike) {
  let answers = 0;
  const offload = createChartOffload({
    minOffloadLength: 0,
    createWorker: () => {
      const worker = createWorker();
      worker.addEventListener('message', () => {
        answers++;
      });
      return worker;
    },
  });
  const [bins, lttb, minMax] = await Promise.all([
    offload.bin(values, { count: 40 }),
    offload.lttb(xs, values, 500),
    offload.minMax(xs, values, 120),
  ]);
  const result = {
    mode: offload.mode,
    answers,
    bins: same(bins, sync.bins),
    lttb: same(lttb, sync.lttb),
    minMax: same(minMax, sync.minMax),
    binCount: bins.length,
  };
  offload.dispose();
  return result;
}

const status = document.getElementById('status');
try {
  const worker = await run(
    () => new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), { type: 'module' })
  );
  const fallback = await run(() => {
    throw new Error('Workers are blocked here.');
  });
  Object.assign(window, { __chartWorker: { worker, fallback } });
  if (status) status.textContent = 'Done';
} catch (error) {
  if (status)
    status.textContent = `Failed: ${error instanceof Error ? error.message : String(error)}`;
}
