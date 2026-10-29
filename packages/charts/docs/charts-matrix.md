# Charts: heatmap, scatter and bubble

**Package:** `@texuli/charts`  
**Import:** `import { HeatmapChart, ScatterChart, BubbleChart, RampLegend } from '@texuli/charts/matrix'`  
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

## `RampLegend`

A labeled color-ramp legend to place beside a heatmap (or any chart that
paints with the theme's sequential or diverging ramp). It shows the title,
the ramp in 2–9 swatches and the values at its ends. Screen readers get one
image whose name is the whole sentence, "Weekly volume, color scale from 0
to 120"; the visible text stays text. The swatches paint through SVG `fill`
attributes (no inline styles, so it is CSP-safe), keep their colors in
forced-colors mode, and the ramp follows the writing direction (it flips on
right-to-left pages, together with its end labels). It is a chart part, not
a catalog component: blueprints do not emit it (the coverage gate lists it
with `Legend` and `Axis`).

```svelte
<HeatmapChart {title} {description} {cells} />
<RampLegend label="Weekly volume" min={0} max={120} />
```

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `label` | string | yes | — | Visible title and the start of the accessible name. |
| `min` | number | no | — | Value at the start of the ramp (lightest, or the negative end when diverging). |
| `max` | number | no | — | Value at the end of the ramp (darkest, or the positive end when diverging). |
| `minLabel` | string | no | — | Text at the start of the ramp ("Low"); wins over the formatted `min`. |
| `maxLabel` | string | no | — | Text at the end of the ramp ("High"); wins over the formatted `max`. |
| `ramp` | `'sequential'` \| `'diverging'` | no | `"sequential"` | Which theme ramp to show; `sequential` is the heatmap's. |
| `steps` | number (2–9) | no | `9` | Swatches; the ramps have nine steps. |
| `formatValue` | `(value: number) => string` | no | `formatMatrixNumber` | Formats `min` and `max` (units such as `%`). |
| `description` | string | no | — | Replaces the derived range sentence after the label. |
| `labels` | `Partial<RampLegendLabels>` | no | English | `range` (`{label}, color scale from {min} to {max}`) and `scale` (`{label}, color scale`, used when an end is missing). |
| `class` | string | no | `""` | Application-authored class value. |

`RAMP_LEGEND_LABELS`, `rampLegendLabels(overrides)` and
`rampLegendText(labels, label, min, max, description?)` give hosts the same
sentence for their own text.

## Props

### `HeatmapChart` (`charts-heatmap`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `cells` | { x, y, value }[] | yes | — | blueprint | Matrix cells keyed by x and y categories. |
| `mode` | `'light'` \| `'dark'` | no | `"light"` | blueprint | Color mode used by the chart frame. |
| `class` | string | no | `""` | developer | Application-authored class value. |
| `width` | number (> 0) | no | `640` | blueprint | Preferred layout width in pixels: the chart lays out at its measured width between 240 and this value, so text keeps its size in narrow columns; wider boxes scale this layout up. |
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
| `width` | number (> 0) | no | `640` | blueprint | Preferred layout width in pixels: the chart lays out at its measured width between 240 and this value, so text keeps its size in narrow columns; wider boxes scale this layout up. |
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
| `width` | number (> 0) | no | `640` | blueprint | Preferred layout width in pixels: the chart lays out at its measured width between 240 and this value, so text keeps its size in narrow columns; wider boxes scale this layout up. |
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
