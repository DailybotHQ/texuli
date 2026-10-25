# Charts: pie, donut, sunburst and treemap

**Package:** `@texuli/charts`  
**Import:** `import { PieChart, DonutChart, SunburstChart, TreemapChart } from '@texuli/charts/part-whole'`

Shares of a whole, flat (`data`) or hierarchical (`root`).

## Charts

| Component | Data | Layout |
| --- | --- | --- |
| `PieChart` | `data: { id, label, value }[]` | `pie` arcs |
| `DonutChart` | same as pie | `PieChart` with `innerRatio` 0.58 by default |
| `SunburstChart` | `root`: a tree node | `sunburst` rings |
| `TreemapChart` | `root`: a tree node | squarified `treemap` |

A tree node is `{ id, label?, value?, children? }`; leaf values are finite and
non-negative. Model helpers: `partWholeColor`, `formatPartWholeValue`,
`treeTableRows`.

## Props

### `PieChart` (`charts-pie`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `data` | { id, label, value }[] | yes | — | blueprint | Flat slice data. |
| `labels` | { table, category, value } | yes | — | blueprint | Localized labels for the accessible data table. |
| `size` | number (> 0) | no | `240` | blueprint | Square view-box size in pixels. |
| `innerRatio` | number (0–0.85) | no | `0` | blueprint | Inner radius as a fraction of the outer radius. |
| `padAngle` | number (≥ 0) | no | `0.01` | blueprint | Angular gap between slices in radians. |

### `DonutChart` (`charts-donut`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `data` | { id, label, value }[] | yes | — | blueprint | Flat slice data. |
| `labels` | { table, category, value } | yes | — | blueprint | Localized labels for the accessible data table. |
| `size` | number (> 0) | no | `240` | blueprint | Square view-box size in pixels. |
| `innerRatio` | number (0–0.85) | no | `0.58` | blueprint | Inner radius as a fraction of the outer radius. |
| `padAngle` | number (≥ 0) | no | `0.01` | blueprint | Angular gap between slices in radians. |

### `SunburstChart` (`charts-sunburst`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `root` | tree node `{ id, label?, value?, children? }` | yes | — | blueprint | Recursive hierarchy rooted at this node. |
| `labels` | { table, category, value } | yes | — | blueprint | Localized labels for the accessible data table. |
| `size` | number (> 0) | no | `240` | blueprint | Square view-box size in pixels. |
| `innerRatio` | number (0–0.75) | no | `0.24` | blueprint | Inner radius as a fraction of the outer radius. |
| `padAngle` | number (≥ 0) | no | `0.008` | blueprint | Angular gap between hierarchy arcs in radians. |

### `TreemapChart` (`charts-treemap`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `root` | tree node `{ id, label?, value?, children? }` | yes | — | blueprint | Recursive hierarchy rooted at this node. |
| `labels` | { table, category, value } | yes | — | blueprint | Localized labels for the accessible data table. |
| `width` | number (> 0) | no | `640` | blueprint | View-box width in pixels. |
| `height` | number (> 0) | no | `360` | blueprint | View-box height in pixels. |
| `padding` | number (≥ 0) | no | `2` | blueprint | Inner padding in pixels. |

`labels` is required on every part-whole chart: pass the three data-table
strings (`table`, `category`, `value`). Chart blocks in `@texuli/blocks` fill
English defaults for you.

## Scales and color

No axes. Slice and tile colors come from the theme's `--tx-chart-1` …
`--tx-chart-8` tokens, falling back to semantic tokens (primary, success, info,
warning, destructive, secondary, accent, link) when a theme has no chart ramp.

## Tiers

Every prop in the tables above is marked `blueprint` (editable from JSON
blueprints, catalog nodes and chart blocks) or `developer` (callbacks and
`class`, set in code only). See [prop schemas and tiers](charts-schemas.md).

## Keyboard

Each chart's data table sits in a native `details` disclosure: Tab reaches
its summary and Enter or Space opens and closes it. There is no point-by-point
keyboard explorer in this family.

## Example

Registry id **`charts-part-whole`**.

## Testing

```bash
pnpm vitest run packages/charts/tests/part-whole.test.ts
TEXULI_E2E_PORT=4870 pnpm visual -g charts-part-whole
```
