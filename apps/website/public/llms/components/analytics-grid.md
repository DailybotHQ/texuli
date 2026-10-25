# AnalyticsGrid

> Auto-fit KPI and widget grid for dashboard screens.

- **id:** `analytics-grid`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- KPI tiles and chart cards inside a dashboard

### Don't use when

- Single full-bleed chart

### Accessibility

- Optional region label names the metrics group.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `columns` | number | no | — | `3` | Preferred column count (1–4) |
| `minItem` | number | no | — | `280` | — |
| `gap` | string | no | — | `"1rem"` | — |
| `dense` | boolean | no | — | `false` | — |
| `label` | string | no | — | — | — |
| `children` | slot | yes | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Three columns (`kpis`)

```json
{
  "columns": 3,
  "label": "Key metrics"
}
```

### Related

- [`layout-dashboard-grid`](layout-dashboard-grid.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
