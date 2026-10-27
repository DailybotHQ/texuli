# Charts: worker offload

**Package:** `@texuli/charts`

**Import:** `import { createChartOffload } from '@texuli/charts/worker'`

An opt-in way to run `bin`, `lttbIndices` and `minMaxBuckets` on very large
series off the main thread. Nothing starts a worker unless the host asks: no
chart family imports this subpath, and `createChartOffload()` with no factory
runs everything on the main thread.

```ts
import { createChartOffload } from '@texuli/charts/worker';

const offload = createChartOffload({
  // The host owns bundling: Vite, Astro and SvelteKit resolve this URL to a worker chunk.
  createWorker: () =>
    new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), { type: 'module' }),
});

const bins = await offload.bin(values, { count: 200 }); // same result as bin(values, { count: 200 })
const indices = await offload.lttb(xs, ys, 2_000); // same result as lttbIndices
offload.dispose();
```

## Contract

- **Same results as the sync math.** The worker entry and the main-thread
  fallback both call one handler (`handleChartOffload`), which runs the
  synchronous `bin`, `lttbIndices` and `minMaxBuckets`. Tests compare every
  operation with the sync call.
- **Transferables.** Inputs travel as `Float64Array` buffers (`null` gaps
  become `NaN`, which the math skips the same way), and results come back as a
  `Float64Array` of `[x0, x1, count]` per bin or a `Uint32Array` of indices.
  Buffers are transferred, not copied.
- **No DOM types in the contract.** `ChartWorkerLike` needs only
  `postMessage(message, transfer)`, `addEventListener` and `terminate` or
  `close`, so a DOM `Worker`, a `MessagePort` or a test double all fit.
- **Graceful fallback.** With no factory, a factory that throws (SSR, a CSP
  that blocks workers), a worker `error` or `messageerror`, or after
  `dispose()`, calls run on the main thread. Calls already in flight are rerun
  from a private copy of their input, so no caller sees a failure. `mode`
  reports `worker` or `main-thread`.
- **Small inputs stay local.** Below `minOffloadLength` (default 50,000 values)
  a round trip costs more than the work, so the call runs on the main thread.

## Size

`pnpm size --filter charts`, 2026-10-25: `@texuli/charts/worker` 2,949 B gzip
(client plus the fallback handler), `@texuli/charts/worker/entry` 2,201 B gzip
(the worker script). Both currently fall under the `@texuli/charts/*` pattern
budget; exact entries are proposed to the budget owner.

## Tested and not tested

- Unit: `packages/charts/tests/worker.test.ts` runs in the node environment
  with a `MessageChannel` standing in for the worker (real structured clone and
  transfer), plus the worker entry in a simulated worker scope, the error and
  creation fallbacks, and the small-input threshold.
- Real browser: `tests/e2e/charts.spec.ts` (its worker step) loads `worker.html` in the
  fixture app, which creates a real module `Worker` with the documented
  `new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), { type: 'module' })`
  pattern. It asserts that bin, LTTB and min-max equal the sync math and that a
  throwing constructor falls back to the main thread, in Chromium, WebKit and
  mobile Chromium. The fixture app maps `@texuli/charts/*` to source through the
  package's exports map (it does not depend on the package).
- Packed tarball: the `vite-plain` consumer in `tests/consumers` installs the
  packed `@texuli/charts`, builds `worker.html` with Vite, checks that the build
  emits a worker chunk that still contains the handler (the side-effect entry
  survives tree-shaking), and runs it in a real browser.
- Perf: `tests/perf/charts-large-data.test.ts` bins and downsamples 1M values
  through the offload and checks the result against the sync path.
- **Not covered yet:** the main-thread time a real browser worker saves is not
  measured, Firefox is not run (a known gap for every browser check), and only
  the Vite consumer builds the worker; the Astro and SvelteKit consumers do not.
