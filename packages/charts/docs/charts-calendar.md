# Charts: calendar heatmap

**Package:** `@texuli/charts`

**Import:** `import { CalendarHeatmap } from '@texuli/charts/calendar'`

`CalendarHeatmap` lays out an inclusive UTC `start` and `end` range with the
public `calendarLayout` math. `values` maps `YYYY-MM-DD` dates to finite numbers;
missing dates remain distinct from zero. Sequential `--tx-chart-*` tokens color
the cells. The component requires a non-empty `title` and `description`,
includes every day in its data table, and formats month ticks as localized
short month and year labels in UTC.

## Props

### `CalendarHeatmap` (`charts-calendar`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | blueprint | Visible chart title and accessible name. |
| `description` | string | yes | — | blueprint | Accessible summary of the chart and its main conclusion. |
| `start` | ISO date \| number | yes | — | blueprint | Inclusive ISO date or epoch milliseconds. |
| `end` | ISO date \| number | yes | — | blueprint | Inclusive ISO date or epoch milliseconds. |
| `values` | Record<string, number> | no | — | blueprint | ISO date keys mapped to finite values. Maps are developer-only input; blueprints use records. |
| `weekStartsOn` | number (integer, 0–6) | no | `1` | blueprint | Day index from Sunday (0) through Saturday (6). |
| `cellSize` | number (> 0) | no | `12` | blueprint | Day-cell size in pixels. |
| `gap` | number (≥ 0) | no | `2` | blueprint | Gap between day cells in pixels. |
| `labels` | { table, date, value, noData } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |

## Tiers

Every prop above is `blueprint` (editable from JSON blueprints, catalog nodes
and chart blocks) unless marked `developer`. See
[prop schemas and tiers](charts-schemas.md).

## Keyboard

The data table sits in a native `details` disclosure: Tab reaches its summary
and Enter or Space opens and closes it. There is no point-by-point keyboard
explorer in this family.

## Example

Registry example id: **`charts-calendar`**.

```bash
pnpm vitest run packages/charts/tests/calendar.test.ts
TEXULI_E2E_PORT=4933 pnpm visual -g charts-calendar
```
