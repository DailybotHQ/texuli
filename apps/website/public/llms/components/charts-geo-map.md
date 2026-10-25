# Geographic map

> A tiled geographic choropleth with a tabular data alternative.

- **id:** `charts-geo-map`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render geographic map from structured content data.

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
| `data` | object | yes | — | — | — |
| `shape` | array | no | — | — | — |
| `labels` | object | no | — | — | — |
| `width` | number | no | — | — | — |
| `height` | number | no | — | — | — |

### Examples

#### Geographic map example (`basic`)

```json
{
  "title": "Orders by region",
  "description": "Regional order totals",
  "data": {}
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
