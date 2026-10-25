# Charts: line, area, bar, stacked bar and combo

**Package:** `@texuli/charts`  
**Import:** `import { LineChart, AreaChart, BarChart, StackedBarChart, ComboChart, CartesianChart } from '@texuli/charts/cartesian'`

The cartesian family draws categorical or numeric x values against a linear y
axis. All five charts share one renderer (`CartesianChart`, which takes a
`kind`) and one prop set.

## Charts

| Component | Draws |
| --- | --- |
| `LineChart` | One line per series; `null` y values leave gaps |
| `AreaChart` | Filled areas; two or more series stack |
| `BarChart` | Bars; two or more series group side by side |
| `StackedBarChart` | Stacked bars (diverging stack, so negatives stack below zero) |
| `ComboChart` | The first series as bars, every other series as lines |

Model helpers: `assertCartesianSeries` (throws on empty or duplicate ids,
non-finite values, or mixed category and numeric x), `xDomain`,
`windowCartesianSeries`, `createCartesianLayout`, `toInteractionSeries`,
`lineCoordinates`.

## Props

All five charts take the same props (`LineChart` shown).

### `LineChart` (`charts-line`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `series` | { id, label, points, color? }[] | yes | — | blueprint | Series and their nested x/y points. |
| `mode` | `'light'` \| `'dark'` | no | `"light"` | blueprint | Color mode used by the chart frame. |
| `annotations` | annotation (`line`, `band`, `point`)[] (≤ 100) | no | `[]` | blueprint | Reference lines, range bands, and point callouts in chart data coordinates. |
| `renderer` | `'svg'` \| `'canvas'` \| `'auto'` | no | `"auto"` | blueprint | SVG, canvas, or automatic dense-series rendering. |
| `class` | string | no | `""` | developer | Application-authored class value. |
| `interactive` | boolean | no | `true` | blueprint | Enable keyboard chart exploration. |
| `brushInvert` | callback `(pixel: number) => number` | no | — | developer | Developer callback that converts brush pixels into domain values. |
| `fullDomain` | [number, number] | no | — | blueprint | Numeric x-axis domain used by zoom and reset controls. |
| `visibleDomain` | [number, number] | no | — | blueprint | Numeric x-axis domain to render for a windowed cartesian series. |
| `onzoom` | callback `(domain: [number, number]) => void` | no | — | developer | Developer zoom event callback. |
| `onbrush` | callback `(domain: [number, number], pixels: BrushRange) => void` | no | — | developer | Developer brush event callback. |
| `onselect` | callback `(selection: ChartSelection) => void` | no | — | developer | Developer point-selection callback. |

## Scales and layout

- **x:** a band scale over the x values in input order (numeric x sort
  ascending). With `visibleDomain`, numeric x use a linear scale over that
  window instead; see [windowed series](charts-large-series.md).
- **y:** a linear scale with nice bounds and about five ticks. Every kind except
  `line` includes zero.
- **View box:** 640 × 320; the SVG scales down to its container.
- **Renderer:** `auto` switches from SVG marks to canvas at 5,000 source points
  (`CANVAS_POINT_THRESHOLD`); see [canvas](charts-canvas.md).
- **Annotations:** reference lines, bands and point callouts; see
  [annotations](charts-annotations.md).

## Tiers

Every prop in the tables above is marked `blueprint` (editable from JSON
blueprints, catalog nodes and chart blocks) or `developer` (callbacks and
`class`, set in code only). See [prop schemas and tiers](charts-schemas.md).

## Keyboard

`interactive` is on by default. The plot is a keyboard explorer (arrow keys,
Home/End, Page Up/Down between series, Escape to dismiss the tooltip); the
full key map is in [interaction](charts-interaction.md#keyboard). With two or
more series, the legend's buttons toggle series with Enter or Space, and the
last visible series cannot be hidden. **Show data table** is a button that
opens the accessible table.

## Examples

Registry ids **`charts-cartesian`** (every kind, light and dark),
**`charts-canvas`** (100,000 points), **`charts-windowed`** (`visibleDomain`)
and **`charts-interaction`** (the building blocks).

## Testing

```bash
pnpm vitest run packages/charts/tests/cartesian.test.ts
TEXULI_E2E_PORT=4870 pnpm exec playwright test tests/e2e/charts.spec.ts tests/e2e/charts-families.spec.ts
TEXULI_E2E_PORT=4870 pnpm visual -g charts-cartesian
```
