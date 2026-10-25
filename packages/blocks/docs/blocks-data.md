# Blocks: table, stat, chart and KPI

**Import:** `import { loadDataFamily, checkDataBlock } from '@texuli/blocks/data'`  
**Task:** T-blocks-data, T-p6-blocks-parity (chart ids)

Lazy data family. Untrusted JSON is validated through `safeParseBlock` /
`checkDataBlock` before anything renders.

## Types

| type | Purpose |
| --- | --- |
| `table` | Caption + columns + rows (string/number/null cells) |
| `stat` | Small labeled figures |
| `kpi` | KPI-oriented row (same item shape as stat) |
| `chart` | Embeds `@texuli/charts` families with required description |

## Chart kinds

A `chart` block's `kind` is a `@texuli/charts` schema id without the
`charts-` prefix. `CHART_KINDS` lists all 24, one for every entry in
`chartPropSchemas` from `@texuli/charts/schemas`. Every block needs `title` and
`description`.

| Kinds | Data | Chart subpath |
| --- | --- | --- |
| `line`, `area`, `bar`, `stacked-bar`, `combo` | top-level `series` (≤ 8 series × 64 points) | `cartesian` |
| `heatmap` | top-level `cells` (≤ 400) | `matrix` |
| `scatter`, `bubble` | top-level `points` (≤ 64; `r` required for bubble) | `matrix` |
| `pie`, `donut`, `sunburst`, `treemap` | `props` | `part-whole` |
| `sparkline`, `bullet`, `gauge`, `progress-ring` | `props` | `compact` |
| `funnel`, `sankey`, `network` | `props` | `flow` |
| `geo-map`, `geo-point-map` | `props` | `geo` |
| `histogram` | `props` | `histogram` |
| `pack` | `props` | `pack` |
| `calendar` | `props` | `calendar` |

```json
{
  "type": "chart",
  "kind": "pie",
  "title": "Plan mix",
  "description": "Share of fictional workspaces by plan.",
  "props": { "data": [{ "id": "team", "label": "Team", "value": 62 }] }
}
```

`props` takes the chart's blueprint props by their chart names (`data`, `root`,
`steps`, `nodes`/`links`, `value`, `values`, `start`/`end`…) and is a closed
set: unknown keys, developer-only props (`class`, `format` and other callbacks)
and `mode` are rejected. The block supplies the chart's `title` (`label` for
compact kinds) and `description`; part-whole charts get default English table
labels unless `props.labels` overrides them. The spec lives in
`src/data/chart-kinds.ts` (`CHART_KIND_PROPS`).

Untrusted caps on `props`: plain-text strings (≤ 500 characters, no control or
bidi characters), finite numbers, ≤ 64 items per array unless noted
(sparkline 256 values, histogram 1,024 samples, geo shapes 256 tiles, flow
links 128), hierarchies ≤ 6 levels and 256 nodes, pixel sizes ≤ 4,096, flow
links that name existing nodes, and calendar ranges of ≤ 400 days.

### Optional chart extras on inline kinds

The eight inline kinds also take an optional `props` object with their
family's blueprint extras, validated by the same spec (`INLINE_CHART_PROPS`):

| Kinds | `props` |
| --- | --- |
| `line`, `area`, `bar`, `stacked-bar`, `combo` | `annotations`, `renderer` (`svg`, `canvas`, `auto`), `interactive`, `fullDomain` (two numbers) |
| `heatmap` | `annotations`, `interactive`, `width`, `height` |
| `scatter`, `bubble` | the heatmap extras plus `series` (≤ 8 `{ id, label, color }` labels) |

A prop on a family whose chart schema lacks it is rejected (for example
`width` on `line`, or `renderer` on `heatmap`). `annotations` (≤ 16, unique
`id`) are reference lines, bands and point callouts: `{ id, type: 'line',
axis, value, label }`, `{ id, type: 'band', axis, start, end, label }` or
`{ id, type: 'point', x, y, label }`. Cartesian y values must be numbers.
Every `color` (series, points, annotations) must be a bare `var(--token)`
reference. Series, series points, heatmap cells and scatter points are closed
objects: unknown keys are rejected, not stripped.

```json
{
  "type": "chart",
  "kind": "line",
  "title": "Sign-ups",
  "description": "Weekly fictional sign-ups against a goal.",
  "series": [{ "id": "new", "label": "New", "points": [{ "x": "W1", "y": 12 }] }],
  "props": {
    "renderer": "svg",
    "annotations": [{ "id": "goal", "type": "line", "axis": "y", "value": 15, "label": "Goal" }]
  }
}
```

`tests/chart-parity.test.ts` checks that `CHART_KINDS` equals the charts schema
ids, that every kind accepts each blueprint prop of its chart schema (inline
kinds through top-level data plus `props`) and requires the chart-required
data, and that one fixture per kind parses and renders.

Not covered: per-kind visual baselines (`blocks-data` covers the original
example only) and the catalog `charts-cartesian` / `charts-canvas-renderer`
ids, which are renderer wrappers rather than chart schema ids. Developer-only
chart props (callbacks such as `onselect`, `brushInvert`, `format`, and
`class`) are never accepted from block JSON.

### Rendering notes

- **Compact kinds** (`sparkline`, `bullet`, `gauge`, `progress-ring`) use their
  `label` only as an accessible name, so `ChartBlockView` renders the block
  `title` as a visible `h3` and the `description` below it.
- **Color fallbacks.** Block JSON stays limited to bare `var(--token)` colors.
  At render time `ChartBlockView` adds the fallback chain the charts use for
  their own defaults: `var(--tx-chart-N)` becomes
  `var(--tx-chart-N, var(--tx-<palette N>, CanvasText))` (primary, success,
  info, warning, destructive, secondary, accent, link for N = 1–8), and any
  other token gets `currentColor`. A theme without chart tokens therefore
  never renders a block color as black. Decision: the fallback is added by
  the renderer, not accepted from block JSON, so untrusted input never carries
  free-form CSS and blocks stored before this change render correctly too.
  To reverse it, drop `themed()` in `ChartBlockView.svelte`.
- **Text wrapping.** Table, stat and KPI blocks break long unspaced values
  anywhere; chart blocks keep normal wrapping, because breaking anywhere
  shrinks chart legends to one character per line.
- **Right-to-left pages.** Chart blocks follow the charts' RTL behavior: the
  block heading, description, legends and tables follow the document
  direction, and each plot stays left to right (see
  `packages/charts/docs/charts-rtl.md`).

## Testing

```bash
pnpm vitest run packages/blocks/tests/data.test.ts packages/blocks/tests/chart-parity.test.ts packages/blocks/tests/chart-render.test.ts
TEXULI_E2E_PORT=4930 pnpm visual:update -g blocks-data
```
