# Stat

> A single metric with optional delta, trend and sparkline slot.

- **id:** `stat`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show one KPI with a human-formatted value

### Don't use when

- A currency/percent KPI with previous period math (use kpi)

### Accessibility

- Label and value are text; trend has a spoken word, not color alone.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | — |
| `value` | string | yes | — | — | The formatted value as display text, such as "$12.4k" or "98%". |
| `delta` | string | no | — | — | The formatted change as display text, such as "+4%". |
| `trend` | enum(up | down | neutral) | no | — | — | — |
| `positive` | enum(up | down) | no | — | `"up"` | Which direction is good |
| `hint` | string | no | — | — | — |
| `icon` | slot | no | — | — | — |
| `sparkline` | slot | no | — | — | — |
| `variant` | enum(elevated | flat) | no | — | `"elevated"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Revenue up (`revenue`)

```json
{
  "label": "Revenue",
  "value": "$12.4k",
  "delta": "+8%",
  "trend": "up"
}
```

### Related

- [`kpi`](kpi.md)
- [`card`](card.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
