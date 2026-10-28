# Charts: sparkline, bullet, gauge and progress ring

**Package:** `@texuli/charts`  
**Import:** `import { Sparkline, BulletChart, Gauge, ProgressRing } from '@texuli/charts/compact'`

Small single-measure views for tables, cards and KPI rows. For a first
screen that only needs the trend and its description, without the data
table, import `Sparkline` from [`@texuli/charts/sparkline-lite`](charts-sparkline-lite.md)
instead: same props, no table.

## Charts

| Component | Shows |
| --- | --- |
| `Sparkline` | A trend over `values` (`line`, `area` or `bar`), optionally the last value |
| `BulletChart` | One `value` against `max`, an optional `target` and qualitative `ranges` |
| `Gauge` | One `value` on a `min`–`max` arc with `thresholds` bands |
| `ProgressRing` | Progress of `value` toward `max` as a ring with a percentage |

## Props

### `Sparkline` (`charts-sparkline`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `values` | number \| null[] | yes | — | blueprint | Ordered values; null creates a gap. |
| `label` | string | yes | — | blueprint | Visible measure label and accessible name. |
| `description` | string | no | — | blueprint | Optional accessible summary; the component derives one when omitted. |
| `period` | string | no | — | blueprint | Optional period text for the data table. |
| `variant` | `'line'` \| `'area'` \| `'bar'` | no | `"line"` | blueprint | Line, area, or bar rendering. |
| `format` | JSON format spec | no | — | blueprint | Declarative number or epoch-millisecond date format; the same output is used for visible and accessible text. |
| `height` | number (> 0) | no | `32` | blueprint | View-box height in pixels. |
| `showLast` | boolean | no | `true` | blueprint | Show the latest finite value beside the sparkline. |
| `labels` | { tableSummary, measure, point, value, noData, current, minimum, maximum, target, range, complete, total, percent } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |

### `BulletChart` (`charts-bullet`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | blueprint | Visible measure label and accessible name. |
| `description` | string | no | — | blueprint | Optional accessible summary; the component derives one when omitted. |
| `value` | number | yes | — | blueprint | Current finite value. |
| `max` | number (> 0) | no | `100` | blueprint | Maximum scale value. |
| `target` | number | no | — | blueprint | Optional target marker. |
| `ranges` | number[] | no | `[]` | blueprint | Ordered qualitative range boundaries. |
| `format` | JSON format spec | no | — | blueprint | Declarative number or epoch-millisecond date format; the same output is used for visible and accessible text. |
| `labels` | { tableSummary, measure, point, value, noData, current, minimum, maximum, target, range, complete, total, percent } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |

### `Gauge` (`charts-gauge`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | blueprint | Visible measure label and accessible name. |
| `description` | string | no | — | blueprint | Optional accessible summary; the component derives one when omitted. |
| `value` | number | yes | — | blueprint | Current finite value. |
| `min` | number | no | `0` | blueprint | Minimum scale value. |
| `max` | number | no | `100` | blueprint | Maximum scale value. |
| `thresholds` | number[] | no | `[]` | blueprint | Ordered band boundaries. |
| `bandLabels` | string[] | no | `[]` | blueprint | Labels aligned with threshold bands. |
| `format` | JSON format spec | no | — | blueprint | Declarative number or epoch-millisecond date format; the same output is used for visible and accessible text. |
| `size` | number (> 0) | no | `144` | blueprint | Square rendered size in pixels. |
| `thickness` | number (> 0) | no | `12` | blueprint | Gauge stroke thickness in pixels. |
| `labels` | { tableSummary, measure, point, value, noData, current, minimum, maximum, target, range, complete, total, percent } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |

### `ProgressRing` (`charts-progress-ring`)

| Prop | Type | Required | Default | Exposure | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | blueprint | Visible measure label and accessible name. |
| `description` | string | no | — | blueprint | Optional accessible summary; the component derives one when omitted. |
| `value` | number | yes | — | blueprint | Current finite value. |
| `max` | number (> 0) | no | `100` | blueprint | Maximum progress value. |
| `format` | JSON format spec | no | — | blueprint | Declarative number or epoch-millisecond date format; the same output is used for visible and accessible text. |
| `size` | number (> 0) | no | `64` | blueprint | Square rendered size in pixels. |
| `thickness` | number (> 0) | no | `7` | blueprint | Ring stroke thickness in pixels. |
| `labels` | { tableSummary, measure, point, value, noData, current, minimum, maximum, target, range, complete, total, percent } | no | labels object | blueprint | Localized labels for the accessible data table and chart text. |

**`label` is not drawn as visible text**, despite the schema's wording. It is
the chart's accessible name (`aria-label` and the SVG `title`) and the data
table caption. Render your own heading when the measure needs a visible label.
Chart blocks in `@texuli/blocks` add one for you.

## Scales and limits

Values map linearly onto the bar, arc or ring. In a sparkline, `null` leaves a
gap; non-finite values never enter the scale.
A sparkline draws at most 2,000 values (`SPARKLINE_MAX_POINTS`); longer series
draw min-max buckets. Above 200 values (`SPARKLINE_TABLE_WINDOW`) its data
table renders a scroll window of rows.

## Tiers

Every prop in the tables above is marked `blueprint` (editable from JSON
blueprints, catalog nodes and chart blocks) or `developer` (`class`, set in
code only). See [prop schemas and tiers](charts-schemas.md).

`format` accepts either `{ "type": "number", ... }` (locale, decimal/percent/
currency style, notation, fraction digits) or `{ "type": "date", ... }`
(locale, time zone, date/time style). Date formatting interprets values as
epoch milliseconds. Invalid locale or option combinations fall back to the
default finite-number formatter. One `Intl` formatter is built per distinct spec and
reused (at most 64 specs are kept), so formatting every value of a long
series costs one formatter, not one per value.

## Keyboard

Each chart's data table sits in a native `details` disclosure: Tab reaches
its summary and Enter or Space opens and closes it. There is no point-by-point
keyboard explorer in this family. A sparkline's windowed table is a focusable, labelled scroll
region, so arrow keys scroll its rows.

## Example

Registry id **`charts-compact`**.

## Testing

```bash
pnpm vitest run packages/charts/tests/compact.test.ts
TEXULI_E2E_PORT=4870 pnpm visual -g charts-compact
```
