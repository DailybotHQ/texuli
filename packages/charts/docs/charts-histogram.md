# Charts: histogram

**Package:** `@texuli/charts`

**Import:** `import { HistogramChart } from '@texuli/charts/histogram'`

`HistogramChart` groups finite `values` with the public `bin` math and renders
token-colored SVG bars. Set `binCount` for an approximate bin count or provide
explicit `thresholds`; `domain` fixes the outer edges. Untrusted input is
bounded: `binCount` is capped at `MAX_BINS` (1,000), a `domain` with a
non-finite edge is ignored, a span too wide for a finite step becomes one bin,
and the extent is one scan, so a long series cannot overflow the stack. A non-empty `title` and
`description` are required, and an expandable data table preserves every range
and count.

## Props

### `HistogramChart` (`charts-histogram`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `values` | number \| null[] | yes | — | blueprint | Finite samples; null values are ignored. |
| `thresholds` | number[] | no | — | blueprint | Explicit ordered bin thresholds. |
| `binCount` | number (integer, ≥ 1) | no | — | blueprint | Requested positive integer bin count. |
| `domain` | [number, number] | no | — | blueprint | Explicit numeric binning domain. |
| `labels` | { table, range, count } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |
| `width` | number (> 0) | no | `640` | blueprint | Preferred layout width in pixels: the chart lays out at its measured width between 240 and this value, so text keeps its size in narrow columns; wider boxes scale this layout up. |
| `height` | number (> 0) | no | `320` | blueprint | View-box height in pixels. |

## Tiers

Every prop above is `blueprint` (editable from JSON blueprints, catalog nodes
and chart blocks) unless marked `developer`. See
[prop schemas and tiers](charts-schemas.md).

## Keyboard

The data table sits in a native `details` disclosure: Tab reaches its summary
and Enter or Space opens and closes it. There is no point-by-point keyboard
explorer in this family.

## Example

Registry example id: **`charts-histogram`**.

```bash
pnpm vitest run packages/charts/tests/statistical.test.ts
TEXULI_E2E_PORT=4931 pnpm visual -g charts-histogram
```
