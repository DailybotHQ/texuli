# Charts: heatmap, scatter and bubble

**Package:** `@texuli/charts`  
**Import:** `import { HeatmapChart, ScatterChart, BubbleChart } from '@texuli/charts/matrix'`  
**Task:** T-charts-matrix

Lazy SVG family on the token chart palette. Every chart requires a non-empty
`title` and accessible `description`, exposes an SVG `role="img"`, and ships a
**View data table** fallback.

## Charts

| Component | Data |
| --- | --- |
| `HeatmapChart` | `cells: { x, y, value }[]` categorical grid |
| `ScatterChart` | `points: { id, label, x, y, seriesId? }[]` |
| `BubbleChart` | points plus required `r` (size domain) |

Optional `series` metadata labels multi-series scatter/bubble legends. `mode`
is `'light' | 'dark'` for chart token fallbacks.

## Model helpers

`assertHeatmapCells`, `assertScatterPoints`, `createHeatmapLayout`,
`createScatterLayout`, `heatmapFill`, `formatMatrixNumber`.

## Props

### `HeatmapChart` (`charts-heatmap`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `cells` | { x, y, value }[] | yes | — | blueprint | Matrix cells keyed by x and y categories. |
| `mode` | `'light'` \| `'dark'` | no | `"light"` | blueprint | Color mode used by the chart frame. |
| `class` | string | no | `""` | developer | Application-authored class value. |
| `width` | number (> 0) | no | `640` | blueprint | View-box width in pixels. |
| `height` | number (> 0) | no | `360` | blueprint | View-box height in pixels. |
| `interactive` | boolean | no | `false` | blueprint | Load keyboard navigation, snapped tooltip, and two-axis crosshair. |
| `annotations` | annotation (`line`, `band`, `point`)[] (≤ 100) | no | `[]` | blueprint | Reference lines, range bands, and point callouts in chart data coordinates. |

### `ScatterChart` (`charts-scatter`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `points` | { id, label, x, y, r?, seriesId?, color? }[] | yes | — | blueprint | Nested quantitative points. |
| `series` | { id, label, color? }[] | no | `[]` | blueprint | Optional series labels and colors. |
| `mode` | `'light'` \| `'dark'` | no | `"light"` | blueprint | Color mode used by the chart frame. |
| `class` | string | no | `""` | developer | Application-authored class value. |
| `width` | number (> 0) | no | `640` | blueprint | View-box width in pixels. |
| `height` | number (> 0) | no | `360` | blueprint | View-box height in pixels. |
| `interactive` | boolean | no | `false` | blueprint | Load keyboard navigation, snapped tooltip, and two-axis crosshair. |
| `annotations` | annotation (`line`, `band`, `point`)[] (≤ 100) | no | `[]` | blueprint | Reference lines, range bands, and point callouts in chart data coordinates. |

### `BubbleChart` (`charts-bubble`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `points` | { id, label, x, y, r, seriesId?, color? }[] | yes | — | blueprint | Nested quantitative points. |
| `series` | { id, label, color? }[] | no | `[]` | blueprint | Optional series labels and colors. |
| `mode` | `'light'` \| `'dark'` | no | `"light"` | blueprint | Color mode used by the chart frame. |
| `class` | string | no | `""` | developer | Application-authored class value. |
| `width` | number (> 0) | no | `640` | blueprint | View-box width in pixels. |
| `height` | number (> 0) | no | `360` | blueprint | View-box height in pixels. |
| `interactive` | boolean | no | `false` | blueprint | Load keyboard navigation, snapped tooltip, and two-axis crosshair. |
| `annotations` | annotation (`line`, `band`, `point`)[] (≤ 100) | no | `[]` | blueprint | Reference lines, range bands, and point callouts in chart data coordinates. |

## Tiers

Every prop above is `blueprint` (editable from JSON blueprints, catalog nodes
and chart blocks) unless marked `developer`. See
[prop schemas and tiers](charts-schemas.md).

## Keyboard

`interactive` is off by default. When it is on, the plot loads the shared
keyboard explorer (arrow keys, Home/End, Page Up/Down between series, Escape
to dismiss the tooltip; see [interaction](charts-interaction.md#keyboard)),
plus a snapped tooltip and a two-axis crosshair. Every matrix chart's data
table sits in a native `details` disclosure: Tab reaches its summary and Enter
or Space opens it.

## Example

Registry id **`charts-matrix`**.

## Testing

```bash
pnpm vitest run packages/charts/tests/matrix.test.ts
TEXULI_E2E_PORT=4930 pnpm visual:update -g charts-matrix
```
