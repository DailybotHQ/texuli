# Combo chart

> A categorical chart that combines bar and line series.

- **id:** `charts-combo`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render combo chart from structured content data.

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
| `series` | array | yes | — | — | — |
| `mode` | enum(light | dark) | no | — | — | — |
| `renderer` | enum(svg | canvas | auto) | no | — | — | — |
| `class` | string | no | — | — | — |
| `interactive` | string | no | — | — | — |
| `fullDomain` | string | no | — | — | — |
| `visibleDomain` | string | no | — | — | — |
| `annotations` | string | no | — | — | — |

### Examples

#### Combo chart example (`basic`)

```json
{
  "title": "Revenue and orders",
  "description": "Revenue and orders by month",
  "series": []
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
