# Windowed cartesian series

Cartesian chart families accept an optional numeric `visibleDomain` to render a
focused x-range from a larger numeric series. The renderer keeps points inside
the inclusive domain and one neighboring sample on either side, so a line that
crosses a viewport edge remains continuous. It maps numeric x values across the
requested domain, clips SVG marks at the plot boundary, and limits axes and
keyboard exploration to that window.

```svelte
<LineChart
  title="Latency by request"
  description="Latency for requests in the selected interval."
  series={latencySeries}
  visibleDomain={[40_000, 60_000]}
/>
```

The `charts-windowed` example moves a 20-request window across a 200-point
series; `tests/e2e/charts-families.spec.ts` checks that keyboard exploration
follows the window.

`visibleDomain` is intended for numeric x values (including epoch-millisecond
time series). It is optional; omitting it preserves the current full-domain
rendering behavior. `fullDomain` remains the complete numeric range used by
zoom/reset interactions, while the host can pass the current view as
`visibleDomain` after handling `onzoom`.

The window limits emitted SVG geometry and the data exposed to the chart's
keyboard explorer. Canvas rendering still applies its existing pixel-bucket
downsampling inside the selected window. This is a rendering window, not a
streaming buffer or an ingestion limit; hosts remain responsible for bounding
untrusted input before it reaches a chart.

## Append-only numeric streams

`appendSeriesWindow` from `@texuli/charts/streaming` returns a new series array with
each appended batch applied to the matching existing series. It requires
strictly increasing finite numeric x values, rejects duplicate or unknown
series batches, and retains a bounded tail per series. The default bound is
10,000 points; `maxPoints` can be set from 1 through 100,000.

`appendCartesianSeriesWindow` from `@texuli/charts/streaming` adapts that math
to cartesian series while preserving their labels, colors, and other metadata.
Both helpers share a lazy subpath so the existing math and cartesian subpaths
remain within their size budgets. The returned immutable value is passed to the
existing `series` prop, so any cartesian family can render updates without
maintaining an internal stream buffer:

```ts
import { appendCartesianSeriesWindow } from '@texuli/charts/streaming';

series = appendCartesianSeriesWindow(
  series,
  [{ seriesId: 'latency', points: [{ x: 60_001, y: 184 }] }],
  { maxPoints: 5_000 }
);
```

The host owns the reactive `series` value and batch scheduling. For a recent
time-series view, it can pair the updated series with `visibleDomain`; streaming
does not implicitly choose a zoom domain or revise prior points. Inputs remain
immutable, and the bounded output must still be treated as developer-provided
data rather than an ingestion security boundary.
