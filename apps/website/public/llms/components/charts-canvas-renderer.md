# Canvas chart renderer

> A low-level canvas mark renderer for dense chart series.

- **id:** `charts-canvas-renderer`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render canvas chart renderer from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `kind` | enum(line | area | bar | stacked-bar | combo) | yes | — | — | — |
| `series` | array | yes | — | — | — |
| `width` | number | yes | — | — | — |
| `height` | number | yes | — | — | — |

### Examples

#### Canvas chart renderer example (`basic`)

```json
{
  "kind": "line",
  "series": [],
  "width": 640,
  "height": 320
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
