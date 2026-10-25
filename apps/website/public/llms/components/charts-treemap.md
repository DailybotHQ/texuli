# Treemap chart

> A hierarchical part-to-whole chart with an accessible table.

- **id:** `charts-treemap`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render treemap chart from structured content data.

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
| `root` | object | yes | — | — | — |
| `labels` | object | yes | — | — | — |
| `width` | number | no | — | — | — |
| `height` | number | no | — | — | — |
| `padding` | number | no | — | — | — |

### Examples

#### Treemap chart example (`basic`)

```json
{
  "title": "Revenue structure",
  "description": "Revenue by product group",
  "root": {
    "id": "root",
    "value": 0
  },
  "labels": {}
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
