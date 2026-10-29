# @texuli/charts

Accessible Svelte 5 charts and the framework-free chart math behind them.
Line, area, bar, pie, treemap, heatmap, Sankey, gauge, box plot and more:
every family is its own lazy subpath, every chart renders an accessible
summary and a data-table fallback, and the scales, shapes and layouts are
plain TypeScript you can use without any component. It is part of
[Texuli](https://texuli.com), "Small pieces. Infinite possibilities.": an MIT
Svelte 5 component library by Dailybot, Inc., for application developers and
for agents that render charts from validated data.

> **Status: 0.x release.** `@texuli/charts` is published on npm as `0.5.0`, a
> pre-1.0 release (1.0.0 will be the first stable release). Under 0.x, a new
> minor (`0.6.0`) may contain breaking changes, so pin the exact version or
> use `^0.5.0`, which accepts only 0.5.x.

## Install

```sh
npm install @texuli/charts @texuli/tokens svelte
```

- `svelte` (^5.57.2) is a peer dependency.
- Charts style themselves with the Texuli `--tx-*` design tokens. Import the
  token stylesheet once in your app (installing `@texuli/tokens` directly lets
  your bundler resolve it); each chart imports its own component CSS.

```css
@import '@texuli/tokens/base.css';
```

## Quick start

```svelte
<script lang="ts">
  import { LineChart, type CartesianSeries } from '@texuli/charts/cartesian';

  const series: CartesianSeries[] = [
    {
      id: 'signups',
      label: 'Sign-ups',
      points: [
        { x: 'Jan', y: 120 },
        { x: 'Feb', y: 180 },
        { x: 'Mar', y: 165 },
      ],
    },
  ];
</script>

<LineChart
  title="Monthly sign-ups"
  description="Sign-ups rose in February and held steady in March."
  {series}
/>
```

`title` and `description` are required: they become the chart's accessible
name and summary. The math works on its own, with no Svelte:

```ts
import { linearScale, lttbIndices } from '@texuli/charts/math';

const y = linearScale({ domain: [0, 180], range: [320, 0], nice: true });
y(90); // pixel position
y.ticks(5); // tick values

const keep = lttbIndices(xs, ys, 500); // downsample a long series to 500 points
```

## What's inside

**Chart families** (Svelte components):

| Import | What it gives you |
| --- | --- |
| `@texuli/charts/cartesian` | `LineChart`, `AreaChart`, `BarChart`, `StackedBarChart`, `ComboChart` and the shared `CartesianChart` |
| `@texuli/charts/part-whole` | Pie, donut, sunburst and treemap charts |
| `@texuli/charts/matrix` | Heatmap, scatter and bubble charts, and `RampLegend` (an accessible color-ramp legend for a heatmap) |
| `@texuli/charts/compact` | `Sparkline`, `BulletChart`, `Gauge` and `ProgressRing`, each with an optional `formatValue(value)` callback |
| `@texuli/charts/sparkline-lite` | A light `Sparkline` (same props): the drawing and its accessible description, without the data table, for first screens |
| `@texuli/charts/flow` | Sankey, funnel and network charts |
| `@texuli/charts/geo` | Schematic tile and point maps |
| `@texuli/charts/histogram` | `HistogramChart` |
| `@texuli/charts/pack` | `PackChart` (circle packing) |
| `@texuli/charts/calendar` | `CalendarHeatmap` |
| `@texuli/charts/statistical` | `BoxPlotChart`, `ViolinChart` and `EcdfChart`, with quantile, density and ECDF math |

**Building blocks:**

| Import | What it gives you |
| --- | --- |
| `@texuli/charts/axis` | Reusable SVG axes, the tick model and numeric and time tick formatters |
| `@texuli/charts/interaction` | Tooltip, legend, data table and keyboard exploration pieces |
| `@texuli/charts/annotations` | `AnnotationLayer`: reference lines, bands and point callouts |
| `@texuli/charts/canvas` | A canvas renderer for dense series |
| `@texuli/charts/colors` | Token-backed categorical, sequential and diverging color scales |
| `@texuli/charts/schemas` | `chartPropSchemas`, the prop schema of every family, for builders and inspectors |

**Data and math** (framework-free TypeScript):

| Import | What it gives you |
| --- | --- |
| `@texuli/charts`, `@texuli/charts/math` | Every math export below, from one entry |
| `@texuli/charts/math/scales` | Linear, log, sqrt, time, band, point and ordinal scales; ticks and nice domains |
| `@texuli/charts/math/shapes` | Line, area and arc paths, pie, stack, bin and symbols |
| `@texuli/charts/math/layout` | Treemap, sunburst, pack, Sankey, funnel, gauge, calendar and matrix layouts |
| `@texuli/charts/math/downsample` | LTTB and min-max downsampling, `bisectX` |
| `@texuli/charts/math/color` | A sequential color fallback |
| `@texuli/charts/streaming` | Immutable, bounded append helpers for live numeric series |
| `@texuli/charts/worker`, `@texuli/charts/worker/entry` | Opt-in Web Worker offload for binning and downsampling very large series, with a main-thread fallback; load the entry with `new Worker(new URL('@texuli/charts/worker/entry', import.meta.url), { type: 'module' })` |

## New in 0.5.0

Ships in `0.5.0`; the `0.4.0` release predates it:

- New subpath `@texuli/charts/sparkline-lite`: a light `Sparkline` with the
  same props, without the data table
  ([charts-sparkline-lite](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-sparkline-lite.md)).
- `RampLegend` in `@texuli/charts/matrix`
  ([charts-matrix](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-matrix.md)).
- `formatValue(value)` on the compact `Sparkline`, `BulletChart`, `Gauge`
  and `ProgressRing`; it wins over `format`
  ([charts-compact](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-compact.md)).

## Key guarantees

- **Accessible by default.** Every chart has `role="img"`, a title and a
  description, plus a data-table fallback: a **Show data table** button on
  the cartesian family and a `details` disclosure everywhere else (except
  the light `Sparkline`, which keeps the name and description and drops the
  table by design). Cartesian
  charts (and matrix charts with `interactive`) add a keyboard explorer:
  arrow keys, Home/End, Page Up/Down between series, Escape to dismiss.
- **Right-to-left ready.** Captions, legends and tables follow the page
  direction; each plot keeps a left-to-right coordinate system.
- **Themeable.** Series colors default to the `--tx-chart-*` tokens, so
  charts follow the active Texuli theme; the full-size families also take a
  `mode` of `light` or `dark`.
- **No third-party chart library.** The scales, shapes and layouts are
  written in-house as plain TypeScript.
- **Bounded on large data.** `Sparkline` draws at most 2,000 samples (longer
  series fall back to min-max buckets so spikes survive), `bin` makes at most
  1,000 bins, and statistical charts cap groups, outliers and density points.
  The cartesian `renderer="auto"` mode switches to canvas at 5,000 points.

## Documentation

- Site: [texuli.com](https://texuli.com) and the
  [charts gallery](https://texuli.com/charts-page/)
- Families:
  [cartesian](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-cartesian.md),
  [part-whole](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-part-whole.md),
  [matrix](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-matrix.md),
  [compact](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-compact.md),
  [light sparkline](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-sparkline-lite.md),
  [flow](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-flow.md),
  [geo](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-geo.md),
  [histogram](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-histogram.md),
  [pack](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-pack.md),
  [calendar](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-calendar.md),
  [statistical](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-statistical.md)
- Building blocks:
  [axis](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-axis.md),
  [interaction and keyboard](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-interaction.md),
  [annotations](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-annotations.md),
  [canvas](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-canvas.md),
  [colors](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-colors.md),
  [prop schemas](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-schemas.md)
- Guides:
  [large and streaming series](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-large-series.md),
  [worker offload](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-worker.md),
  [right-to-left layouts](https://github.com/DailybotHQ/texuli/blob/main/packages/charts/docs/charts-rtl.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-charts).
