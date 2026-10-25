# Charts: funnel, sankey and network

**Package:** `@texuli/charts`  
**Import:** `import { FunnelChart, SankeyChart, NetworkGraph } from '@texuli/charts/flow'`

Steps, weighted flows and connections.

## Charts

| Component | Data | Layout |
| --- | --- | --- |
| `FunnelChart` | ordered `steps: { id, label?, value }[]` | `funnelLayout`, vertical or horizontal |
| `SankeyChart` | `nodes` and weighted `links` | `sankey`: columns by longest path from the sources, heights proportional to flow, links stacked at both ends |
| `NetworkGraph` | `nodes` and optional-weight `links` | `networkLayout`: nodes on a stable circle, so identical input always yields identical geometry |

Sankey flows must form a directed acyclic graph; cycles are rejected. Model
helpers: `FLOW_CHART_LABELS`, `flowChartLabels`, `flowColor`,
`formatFlowValue`, `formatFlowPercent`, `networkLayout`.

## Props

### `FunnelChart` (`charts-funnel`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | no | — | blueprint | Optional accessible summary; the component derives one when omitted. |
| `steps` | { id, label?, value }[] | yes | — | blueprint | Ordered conversion steps. |
| `orientation` | `'vertical'` \| `'horizontal'` | no | `"vertical"` | blueprint | Direction of the funnel. |
| `width` | number (> 0) | no | `640` | blueprint | Preferred layout width in pixels: the chart lays out at its measured width between 240 and this value, so text keeps its size in narrow columns; wider boxes scale this layout up. |
| `height` | number (> 0) | no | `320` | blueprint | View-box height in pixels. |
| `labels` | { tableSummary, step, count, conversion, from, to, value, node, connection } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |
| `class` | string | no | — | developer | Application-authored class value. |

### `SankeyChart` (`charts-sankey`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | no | — | blueprint | Optional accessible summary; the component derives one when omitted. |
| `nodes` | { id, label? }[] | yes | — | blueprint | Unique flow nodes. |
| `links` | { source, target, value }[] | yes | — | blueprint | Weighted source-to-target flows. |
| `width` | number (> 0) | no | `640` | blueprint | Preferred layout width in pixels: the chart lays out at its measured width between 240 and this value, so text keeps its size in narrow columns; wider boxes scale this layout up. |
| `height` | number (> 0) | no | `360` | blueprint | View-box height in pixels. |
| `labels` | { tableSummary, step, count, conversion, from, to, value, node, connection } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |
| `class` | string | no | — | developer | Application-authored class value. |

### `NetworkGraph` (`charts-network`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | no | — | blueprint | Optional accessible summary; the component derives one when omitted. |
| `nodes` | { id, label?, value? }[] | yes | — | blueprint | Unique graph nodes. |
| `links` | { source, target, value? }[] | yes | — | blueprint | Source-to-target graph connections. |
| `width` | number (> 0) | no | `480` | blueprint | Preferred layout width in pixels: the chart lays out at its measured width between 240 and this value, so text keeps its size in narrow columns; wider boxes scale this layout up. |
| `height` | number (> 0) | no | `360` | blueprint | View-box height in pixels. |
| `labels` | { tableSummary, step, count, conversion, from, to, value, node, connection } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |
| `class` | string | no | — | developer | Application-authored class value. |

## Tiers

Every prop in the tables above is marked `blueprint` (editable from JSON
blueprints, catalog nodes and chart blocks) or `developer` (callbacks and
`class`, set in code only). See [prop schemas and tiers](charts-schemas.md).

## Keyboard

Each chart's data table sits in a native `details` disclosure: Tab reaches
its summary and Enter or Space opens and closes it. There is no point-by-point
keyboard explorer in this family.

## Example

Registry id **`charts-flow`**.

## Testing

```bash
pnpm vitest run packages/charts/tests/flow.test.ts
TEXULI_E2E_PORT=4870 pnpm visual -g charts-flow
```
