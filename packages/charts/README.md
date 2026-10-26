# @texuli/charts

**Layer L4: charts.** Chart math and every chart family, one lazy subpath
per family. Published to npm as `0.1.0-next.1` under the `next`
dist-tag (by CI, with provenance); no stable release (`latest` is reserved
for 1.0.0), so install it with `@next`. The workspace package stays
`"private": true`.

## What exists today

**Chart math** (`@texuli/charts` and `@texuli/charts/math`): framework-free
TypeScript — scales, shapes, layouts and downsampling. No Svelte, no third-party
chart library. Ported from Protoyard's `@protoyard/charts` engine so results match.

| Area | Subpath | Exports (selected) |
| --- | --- | --- |
| Scales | `@texuli/charts/math/scales` | `linearScale`, `logScale`, `sqrtScale`, `timeScale`, `bandScale`, `pointScale`, `ordinalScale`, `ticks`, `niceDomain`, `extent`, format helpers |
| Shapes | `@texuli/charts/math/shapes` | `linePath`, `areaPath`, `arcPath`, `pie`, `stack`, `bin` (`MAX_BINS` from `math/shapes/bin.ts`), `symbolPath` |
| Layouts | `@texuli/charts/math/layout` | `treemap`, `sunburst`, `pack`, `sankey`, `funnelLayout`, `gaugeLayout`, `calendarLayout`, `matrixLayout`, `plotArea` |
| Downsample | `@texuli/charts/math/downsample` | `lttbIndices`, `largestTriangleThreeBuckets`, `minMaxBuckets`, `bisectX` |
| Color | `@texuli/charts/math/color` | `sequentialFallback` |

`@texuli/charts/math` (and the package root) is a facade: an exact union of the
family subpaths, with the same bindings. Import a family subpath when you need
one area. Each family is measured as its own `pnpm size` entry, so new math
lands in the family it belongs to instead of growing one 12 KiB entry.

```ts
import { linearScale, lttbIndices, treemap } from '@texuli/charts';
// or: import { … } from '@texuli/charts/math';
// or one family: import { linearScale } from '@texuli/charts/math/scales';
```

**Chart families** are lazy package subpaths:

| Subpath | Components |
| --- | --- |
| `@texuli/charts/cartesian` | Cartesian, line, area, bar, stacked bar and combo charts ([docs](docs/charts-cartesian.md)) |
| `@texuli/charts/part-whole` | Pie, donut, sunburst and treemap charts ([docs](docs/charts-part-whole.md)) |
| `@texuli/charts/matrix` | Heatmap, scatter and bubble charts ([docs](docs/charts-matrix.md)) |
| `@texuli/charts/compact` | Sparkline, bullet, gauge and progress ring charts ([docs](docs/charts-compact.md)) |
| `@texuli/charts/flow` | Sankey, funnel and network charts ([docs](docs/charts-flow.md)) |
| `@texuli/charts/geo` | Schematic tile and point maps ([docs](docs/charts-geo.md)) |
| `@texuli/charts/histogram` | `HistogramChart`, built on `bin` ([docs](docs/charts-histogram.md)) |
| `@texuli/charts/pack` | `PackChart`, built on `pack` ([docs](docs/charts-pack.md)) |
| `@texuli/charts/calendar` | `CalendarHeatmap`, built on `calendarLayout` ([docs](docs/charts-calendar.md)) |
| `@texuli/charts/statistical` | `BoxPlotChart`, `ViolinChart` and `EcdfChart`, with quantile, box-summary, kernel-density and ECDF math ([docs](docs/charts-statistical.md)) |
| `@texuli/charts/worker` | Opt-in worker offload for `bin`, LTTB and min-max on very large series, with a main-thread fallback ([docs](docs/charts-worker.md)) |
| `@texuli/charts/streaming` | Immutable bounded append helpers for numeric chart series ([docs](docs/charts-large-series.md#append-only-numeric-streams)) |
| `@texuli/charts/canvas` | Dense-series canvas renderer ([docs](docs/charts-canvas.md)) |
| `@texuli/charts/interaction` | Tooltip, legend, table and exploration building blocks ([docs](docs/charts-interaction.md)) |
| `@texuli/charts/axis` | Reusable SVG axes, tick model and numeric/time formatters ([docs](docs/charts-axis.md)) |
| `@texuli/charts/annotations` | `AnnotationLayer` and the shared annotation model used by the Cartesian and matrix charts ([docs](docs/charts-annotations.md)) |
| `@texuli/charts/schemas` | The per-family prop schemas (`chartPropSchemas`) for builders and inspectors ([docs](docs/charts-schemas.md)) |
| `@texuli/charts/colors` | Token-backed categorical, sequential, and diverging color scale helpers ([docs](docs/charts-colors.md)) |

Every chart family renders accessible text (`role="img"`, a label, title and
description) and a data-table fallback: the shared `ChartTable` behind a
**Show data table** button on the Cartesian family, and a `details` disclosure
in every other family. Only cartesian charts (by default) and matrix charts
(with `interactive`) add a point-by-point keyboard explorer.

Every subpath above links its reference in [`docs/`](docs/): components, props
(generated from `@texuli/charts/schemas`, with their `blueprint` or `developer`
exposure), scales and layout, keyboard access and the registered example. The
math subpaths are described in the table at the top of this page. The eleven
family examples are
registered in the examples registry (`charts-cartesian`, `charts-part-whole`,
`charts-matrix`, `charts-compact`, `charts-flow`, `charts-geo`,
`charts-histogram`, `charts-pack`, `charts-calendar`, `charts-canvas`,
`charts-interaction`), as are `charts-statistical`, `charts-windowed`
(`visibleDomain`) and the right-to-left `charts-rtl`; all carry visual
baselines in `tests/visual/`.

Charts work in right-to-left pages: captions, legends and tables follow the
document direction, while each plot keeps a left-to-right coordinate system
(`direction="ltr"` on every chart SVG). See [right-to-left layouts](docs/charts-rtl.md).

Cartesian, matrix, and histogram charts use the shared axis renderer and its
deterministic default number formatting. Custom `Axis` compositions accept a
typed `format` callback; `formatNumericAxisTick` and `formatTimeAxisTick` are
available from `@texuli/charts/axis`.

Cartesian families can render a numeric x-domain window from a larger series
with the optional `visibleDomain` prop; see [windowed cartesian series](docs/charts-large-series.md).
Append-only numeric updates are available through `appendSeriesWindow` and
`appendCartesianSeriesWindow` in `@texuli/charts/streaming`.

## Large-data limits

What stays bounded however long the input is:

| Surface | Limit |
| --- | --- |
| `Sparkline` marks | At most `SPARKLINE_MAX_POINTS` (2,000) drawn samples plus the end marker; longer series draw min-max buckets (first, lowest, highest, last and gaps per bucket), so spikes survive |
| `Sparkline` data table | Past `SPARKLINE_TABLE_WINDOW` (200) values the table renders a scroll window of rows (`tableWindow`, the same pattern as `ChartTable`) in a focusable region; `aria-rowcount` and `aria-rowindex` keep the full count, and every row stays reachable by scrolling |
| `bin` and `HistogramChart` | At most `MAX_BINS` (1,000) bins from `count`; the extent is one scan |
| Statistical marks | 100,000 values per group, 24 groups, 200 drawn outliers, 512 density points; each group is sorted once |

`pnpm test:perf` runs `tests/perf/charts-large-data.test.ts`, which asserts
these output bounds and wall-clock budgets calibrated against a native 100k
sort. Measured numbers are in [PERFORMANCE](../../docs/PERFORMANCE.md).

## Testing

```bash
pnpm vitest run packages/charts
pnpm --filter @texuli/charts typecheck
npx biome check packages/charts
pnpm size --filter charts
TEXULI_E2E_PORT=4870 pnpm exec playwright test tests/e2e/charts.spec.ts tests/e2e/charts-families.spec.ts
```

The browser specs run on the registered examples (`/?fixture=<id>`) in Chromium,
the Pixel 7 profile and WebKit:

| Spec area | What it checks | Fixture |
| --- | --- | --- |
| Keyboard exploration | Arrow/Page keys announce points; Escape closes the tooltip; axe has no violations | `charts-interaction`, `charts-cartesian` |
| Tooltips | Pointer hover shows a tooltip beside the snapped point listing every series; it hides when the pointer leaves | `charts-cartesian` |
| Legends | Space/Enter toggle series (`aria-pressed`), hidden series lose their marks, the last visible series stays locked | `charts-cartesian` |
| `visibleDomain` | Exploration is limited to the window plus one neighbor per side; moving the window moves the first and last points | `charts-windowed` |
| Data tables | The cartesian table toggle works with Enter/Space and returns focus; every family's `details` disclosure is reachable with Tab and opens with Enter | `charts-cartesian`, part-whole, matrix, flow, geo, compact, histogram, statistical |
| Canvas renderer | Dense series draw on an `aria-hidden` canvas, emit no SVG marks, keep a named plot, a downsampled explorer and the data table | `charts-canvas` |
| Right-to-left | Plot SVGs compute `direction: ltr`, heatmap row labels end before the cells, captions align to the right, the tooltip stays beside its point | `charts-rtl` |

Not covered in the browser: the worker offload surface (separate task), Firefox,
and pointer brushing/zoom.
