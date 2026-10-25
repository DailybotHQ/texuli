# Data, chart and composition performance checks

Run these wall-clock checks serially; they are kept out of the parallel unit
suite because machine load changes measured duration:

```sh
TEXULI_PERF=1 pnpm vitest run tests/perf --maxWorkers=1 --no-file-parallelism
```

`TEXULI_PERF=1` is required: the catalog render-limit check in `tests/perf`
fails without it. `pnpm test:perf` sets it too, but runs the files in parallel.

The suite measures stable, seeded workloads through the data grid, schedule,
tree and map engines, chart canvas downsampling, and composition canvas drawing.
Each benchmark warms up and takes the best of three samples. Data engine
budgets use a same-process native 100,000-number sort as a load calibration;
the chart and composition checks keep explicit output-size and duration caps.
The virtualized chart data table has a separate unit test that asserts its
visible row count stays bounded for a 100,000-row input.

Historical local serial observation (Node 26.11.1, 2026-10-23):

| Workload | Observed | Gate |
| --- | ---: | --- |
| Grid 100k: sort / text sort / filter / group | 46.8 / 91.6 / 7.4 / 9.5 ms | max of 150 ms and 30× local sort calibration |
| Schedule cascade 2k | 31.2 ms, 2,000 changes | max of 60 ms and 5× local sort calibration |
| Tree flatten 10k | 0.6 ms | max of 30 ms and 3× local sort calibration |
| Map cluster 5k | 2.19 ms | max of 10 ms and 2× local sort calibration |
| Chart downsample 100k | 3.2 ms, 2,546 output points | under 4,000 points and max of 100 ms and 20× local sort calibration |
| Composition draw 256 | 0.2 ms, 256 layers | under 250 ms |

These timings are environment observations, not portable promises. The tests
enforce workload and regression bounds; rerun them on the target machine for
comparable measurements.

## Current gate result

The serial gate was rerun on 2026-10-25 against dev `852b8d2a`:
`TEXULI_PERF=1 pnpm vitest run tests/perf --maxWorkers=1
--no-file-parallelism` passed all 14 tests. The suite did not emit a new
timing table in its captured output, so the 2026-10-23 values above remain
historical observations, not today's measurements. The assertions still
check their configured thresholds.

The current composition performance case covers the v1 model and canvas draw
path. Composition-v2 and the export queue are present in `@texuli/media`, but
a dedicated performance case for either remains **planned**. The latest
`pnpm size --filter media --json` run on dev `852b8d2a` passed all 26 live
media budget rows: the package root is 45,162/49,152 B gzip and
`@texuli/media/composition-v2` is 11,103/12,288 B. The `export` and `export/ui`
entries have lazy chunks of 19,916 B and 20,324 B respectively; the lazy-size
column is currently uncapped. These are bundle-size measurements, not runtime
performance measurements.
