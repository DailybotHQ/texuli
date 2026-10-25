# Scatter chart

> A quantitative scatter plot with an accessible data table.

- **id:** `charts-scatter`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render scatter chart from structured content data.

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
| `points` | array | yes | — | — | — |
| `series` | array | no | — | — | — |
| `mode` | enum(light | dark) | no | — | — | — |
| `interactive` | string | no | — | — | — |
| `class` | string | no | — | — | — |
| `width` | number | no | — | — | — |
| `height` | number | no | — | — | — |
| `annotations` | string | no | — | — | — |

### Examples

#### Scatter chart example (`basic`)

```json
{
  "title": "Usage and reach",
  "description": "Usage compared with reach",
  "points": []
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
