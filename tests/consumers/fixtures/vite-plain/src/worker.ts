import { lttbIndices } from '@texuli/charts/math/downsample';
import { bin } from '@texuli/charts/math/shapes';
import { createChartOffload, toFloat64 } from '@texuli/charts/worker';

// The documented host pattern, resolved by Vite through the packed exports map.
const values = Array.from({ length: 60_000 }, (_, i) => (i % 97 === 0 ? null : (i * 37) % 1_000));
const xs = values.map((_, i) => i);
const status = document.getElementById('worker-status') as HTMLOutputElement;

let answers = 0;
const offload = createChartOffload({
  minOffloadLength: 0,
  createWorker: () => {
    const worker = new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', () => {
      answers++;
    });
    return worker;
  },
});

async function run() {
  const [bins, indices] = await Promise.all([
    offload.bin(values, { count: 25 }),
    offload.lttb(xs, values, 400),
  ]);
  const same =
    JSON.stringify(bins) === JSON.stringify(bin(values, { count: 25 })) &&
    JSON.stringify(indices) === JSON.stringify(lttbIndices(xs, toFloat64(values), 400));
  status.dataset.mode = offload.mode;
  status.dataset.answers = String(answers);
  status.dataset.same = String(same);
  status.textContent = 'Done';
  offload.dispose();
}

void run();
