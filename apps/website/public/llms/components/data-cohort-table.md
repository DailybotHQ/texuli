# Cohort table

> A retention table: one row per cohort, one column per period after it started, as rates or counts, with optional heat tints and an averages row.

- **id:** `data-cohort-table`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Show how groups that started at different times keep going, period by period

### Don't use when

- One trend over time: use a line chart
- Records people sort and search: use data-grid

### Accessibility

- A real table: a caption, period column headers and cohort row headers with scope
- Heat tints are decorative and contrast-safe; the number stays the cell content

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `caption` | string | yes | untrusted | — | The table caption and accessible name: what is measured and how. |
| `rows` | array | yes | — | — | Cohorts, one row each: a label, an optional size and one value per period reached (rates from 0 to 1, or counts). incomplete marks the last value as a period still in progress. |
| `periods` | array | no | — | — | Period column headers ("Month 0", "Month 1"…); missing ones are numbered. |
| `captionHidden` | boolean | no | — | `false` | — |
| `valueKind` | enum(rate | count) | no | — | `"rate"` | — |
| `heat` | boolean | no | — | `false` | — |
| `max` | number | no | — | — | Top of the heat scale (default: 1 for rates, the largest cell for counts). |
| `average` | boolean | no | — | `false` | Adds an averages row, weighted by cohort size when every cohort has one. |
| `density` | enum(compact | default | comfortable) | no | — | `"compact"` | — |
| `locale` | string | no | — | `"en-US"` | — |

### Examples

#### Monthly retention (`monthly-retention`)

```json
{
  "caption": "Share of accounts active each month after signup",
  "periods": [
    "Month 0",
    "Month 1",
    "Month 2"
  ],
  "heat": true,
  "average": true,
  "rows": [
    {
      "label": "Aug 2026",
      "size": 420,
      "cells": [
        1,
        0.62,
        0.48
      ]
    },
    {
      "label": "Sep 2026",
      "size": 380,
      "cells": [
        1,
        0.58,
        0.51
      ],
      "incomplete": true
    },
    {
      "label": "Oct 2026",
      "size": 455,
      "cells": [
        1,
        0.66
      ],
      "incomplete": true
    }
  ]
}
```

### Related

- [`data-grid`](data-grid.md)
- [`charts-heatmap`](charts-heatmap.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
