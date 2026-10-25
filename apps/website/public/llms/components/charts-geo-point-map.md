# Geographic point map

> Geographic points positioned on a tiled map.

- **id:** `charts-geo-point-map`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render geographic point map from structured content data.

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
| `shape` | array | no | — | — | — |
| `labels` | object | no | — | — | — |
| `width` | number | no | — | — | — |
| `height` | number | no | — | — | — |

### Examples

#### Geographic point map example (`basic`)

```json
{
  "title": "Locations",
  "description": "Sample locations",
  "points": []
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
