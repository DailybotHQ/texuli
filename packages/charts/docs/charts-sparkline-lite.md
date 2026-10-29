# Charts: light sparkline

**Package:** `@texuli/charts`  
**Import:** `import { Sparkline } from '@texuli/charts/sparkline-lite'`

A light `Sparkline` for first screens such as KPI tiles and table rows. It
takes the props of the `Sparkline` in [`@texuli/charts/compact`](charts-compact.md)
(catalog id `charts-sparkline`) and draws the same trend with the same
accessible name and description, but leaves out the data table and its
scroll window. Switching is an import path change. Use the compact
`Sparkline` when readers need every value in a table; use this one when the
trend and its summary are enough.

## Props

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `values` | number \| null[] | yes | — | Ordered values; null creates a gap. |
| `label` | string | yes | — | Accessible name of the chart (`role="img"`, `<title>`). |
| `description` | string | no | — | Accessible description; derived from the values when omitted. |
| `period` | string | no | — | Appended to the derived description (`Period: …`). |
| `variant` | `'line'` \| `'area'` \| `'bar'` | no | `"line"` | Line, area or bar rendering. |
| `format` | JSON format spec | no | — | The `ChartFormatSpec` of `Sparkline`, for the values in the derived description. A spec `Intl` rejects falls back to plain numbers. |
| `formatValue` | `(value: number) => string` | no | — | Formats the values in the derived description; wins over `format`. |
| `height` | number | no | `32` | View-box height, clamped to 12–120. |
| `showLast` | boolean | no | `true` | Mark the latest finite value. |
| `labels` | `Partial<CompactChartLabels>` | no | — | Only `noData` is read (the description of a series with no finite value, default `"No data"`); there is no table to label. |

The derived description reads like `6 values; increased from 3 to 9. Period: 6 days.`

## What it leaves out, and why it is lighter

- No `<details>` data table and no windowed rows, so no `{#each}` block and no
  table-window math.
- Bars are two `<path>` elements (the earlier bars and the latest one), not a
  `<rect>` per value. `barsPaths(geometry)` builds them and is exported for
  hosts that draw their own bars.
- One `Intl` formatter per `format` change, without the shared formatter
  cache.

Series past 2,000 values draw min-max buckets, like `Sparkline`, so the path
stays bounded.

Measured 2026-10-28 with a production Vite build (Svelte bundled, gzip
level 9), as the first-screen JavaScript it adds to a page over the same page
without a chart:

| Harness | compact `Sparkline` | light `Sparkline` |
| --- | --- | --- |
| Two pages (chart, baseline) | 3,373 B | 2,210 B |
| Three pages (`packages/charts/tests/sparkline-lite.test.ts`) | 3,566 B | 2,628 B |

Its scoped CSS is 163 B gzip (424 B for the compact one). The test keeps
the light entry's JavaScript under 3,300 B and below the compact one.

## Accessibility

The `<svg>` has `role="img"`, its `label` as the accessible name and the
description in `<desc>`. There is no focusable part. Colors come from
`--tx-chart-1`, and forced-colors mode keeps the system colors.

## Testing

```bash
pnpm vitest run packages/charts/tests/sparkline-lite.test.ts
```
