# Sparkline

> A compact line, area or bar trend chart.

- **id:** `charts-sparkline`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render sparkline from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `values` | array | yes | — | — | — |
| `label` | string | yes | — | — | — |
| `description` | string | no | — | — | — |
| `period` | string | no | — | — | — |
| `variant` | enum(line | area | bar) | no | — | — | — |
| `format` | object | no | — | — | — |
| `height` | number | no | — | — | — |
| `showLast` | boolean | no | — | — | — |
| `labels` | object | no | — | — | — |

### Examples

#### Sparkline example (`basic`)

```json
{
  "label": "Daily active users",
  "values": [
    18,
    21,
    19,
    26
  ]
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
