# Charts: statistical marks

**Package:** `@texuli/charts`

**Import:** `import { BoxPlotChart, ViolinChart, EcdfChart } from '@texuli/charts/statistical'`

Three distribution charts on owned, framework-free statistics. Each takes
groups (or series) of `{ id, label, values }`, requires a non-empty `title`
and `description`, and keeps an expandable data table.

| Component | Draws | Table |
| --- | --- | --- |
| `BoxPlotChart` | Tukey box per group: quartile box, median rule, whiskers to the most extreme values inside `q1 − k·IQR … q3 + k·IQR` (`whisker`, default `k = 1.5`; `Infinity` reaches min and max), outlier dots | Count, minimum, quartiles, median, maximum |
| `ViolinChart` | Mirrored Gaussian kernel density per group (`bandwidth`, default Silverman's rule) with a median rule; every violin shares one density scale, so wider means denser | Same quartile summary |
| `EcdfChart` | Empirical cumulative distribution step line per series, with a legend when there are several | Value at the 25 %, 50 %, 75 % and 100 % shares per series |

All three share one value axis across groups; `domain` fixes it. `width`
(default 640) is the preferred layout width: each chart lays out at its
measured width between 240 and that value, so labels keep their size in narrow
columns; `height` (default 320) is fixed.

```ts
import { BoxPlotChart } from '@texuli/charts/statistical';
// <BoxPlotChart title="Request latency" description="Latency quartiles per service, in ms."
//   groups={[{ id: 'api', label: 'API', values: [12, 15, 18, 22, 95] }]} />
```

## Statistics

The same subpath exports the math, usable without Svelte:

- `quantileSorted(sorted, p)`: linear interpolation (R-7, the spreadsheet default).
- `boxSummary(values, { whisker })`: count, min, quartiles, max, whiskers and outliers, or `null` with no finite values.
- `kernelDensity(values, { bandwidth, points, domain })`: Gaussian KDE sampled at evenly spaced points.
- `ecdf(values)`: one `{ x, p, count }` step per distinct value.
- `createBoxLayout`, `createViolinLayout`, `createEcdfLayout`: rounded SVG coordinates for each chart.

## Untrusted input

Values may come from an agent, so every function tolerates hostile input:

- non-numbers, `NaN`, `±Infinity` and magnitudes above `MAX_STAT_MAGNITUDE` (1e300) are dropped;
- at most `MAX_STAT_VALUES` (100,000) inputs are read per group;
- at most `MAX_STAT_GROUPS` (24) groups are drawn, the first per id wins, and a blank label falls back to the id;
- a box draws at most `MAX_DRAWN_OUTLIERS` (200) dots, sampled evenly (the summary keeps every outlier);
- a density curve has at most `MAX_DENSITY_POINTS` (512) points;
- no step spreads an array into a function call, so a long series cannot overflow the stack.

Labels render as text nodes, never as HTML. The hostile corpus in
[`tests/hostile/`](../tests/hostile/README.md) runs every sample through these
summaries, layouts and components.

## Status

Measured with `pnpm size --filter charts`: 7.00 KiB gzip, inside the default
12 KiB `@texuli/charts/*` budget.

**Planned, not done yet:** a registry example id (`charts-statistical`) and
its visual baselines, catalog manifests, keyboard exploration through
`@texuli/charts/interaction`, and a strip (jittered dot) mark.

```bash
pnpm vitest run packages/charts/tests/statistical.test.ts
pnpm size --filter charts
```
