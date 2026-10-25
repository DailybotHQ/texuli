# Gauge chart

> A radial value gauge with thresholds and an accessible data table.

- **id:** `charts-gauge`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render gauge chart from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | — |
| `description` | string | no | — | — | — |
| `value` | number | yes | — | — | — |
| `min` | number | no | — | — | — |
| `max` | number | no | — | — | — |
| `thresholds` | array | no | — | — | — |
| `bandLabels` | array | no | — | — | — |
| `format` | object | no | — | — | — |
| `size` | number | no | — | — | — |
| `thickness` | number | no | — | — | — |
| `labels` | object | no | — | — | — |

### Examples

#### Gauge chart example (`basic`)

```json
{
  "label": "Service health",
  "value": 92,
  "min": 0,
  "max": 100
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
