# Pie chart

> A part-to-whole chart with an accessible data table.

- **id:** `charts-pie`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render pie chart from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | — | — |
| `description` | string | yes | — | — | — |
| `data` | array | yes | — | — | — |
| `labels` | object | yes | — | — | — |
| `size` | number | no | — | — | — |
| `innerRatio` | string | no | — | — | — |
| `padAngle` | string | no | — | — | — |

### Examples

#### Pie chart example (`basic`)

```json
{
  "title": "Tickets by status",
  "description": "Ticket distribution",
  "data": [],
  "labels": {}
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
