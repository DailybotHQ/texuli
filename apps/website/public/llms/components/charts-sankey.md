# Sankey chart

> A weighted flow diagram with an accessible table.

- **id:** `charts-sankey`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render sankey chart from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | — | — |
| `description` | string | no | — | — | — |
| `nodes` | array | yes | — | — | — |
| `links` | array | yes | — | — | — |
| `width` | number | no | — | — | — |
| `height` | number | no | — | — | — |
| `labels` | object | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Sankey chart example (`basic`)

```json
{
  "title": "Traffic sources",
  "nodes": [],
  "links": []
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
