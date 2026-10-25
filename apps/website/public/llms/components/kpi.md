# KPI

> A formatted metric with unit, previous-period delta and optional link.

- **id:** `kpi`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show a numeric KPI with unit formatting and comparison

### Don't use when

- A free-form already-formatted string (use stat)

### Accessibility

- Loading and empty states are announced; linked tiles use real anchors after URL policy.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | — |
| `value` | number | no | — | — | Current numeric value (nullable) |
| `unit` | enum(number | compact | cents | percent) | no | — | `"number"` | — |
| `currency` | string | no | — | — | ISO currency when unit is cents |
| `previous` | number | no | — | — | — |
| `comparisonLabel` | string | no | — | — | — |
| `positive` | enum(up | down) | no | — | `"up"` | — |
| `sparkline` | slot | no | — | — | — |
| `href` | string | no | developer | — | — |
| `hrefTrust` | enum(developer | untrusted) | no | — | `"developer"` | — |
| `loading` | boolean | no | — | `false` | — |
| `empty` | unknown | no | — | — | true or empty message string |
| `variant` | enum(elevated | flat) | no | — | `"elevated"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Orders KPI (`orders`)

```json
{
  "label": "Orders",
  "value": 1280,
  "unit": "compact",
  "previous": 1100,
  "comparisonLabel": "vs last week"
}
```

### Related

- [`stat`](stat.md)
- [`card`](card.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
