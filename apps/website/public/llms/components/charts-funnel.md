# Funnel chart

> A conversion funnel with step values and accessible table.

- **id:** `charts-funnel`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render funnel chart from structured content data.

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
| `steps` | array | yes | — | — | — |
| `orientation` | enum(vertical | horizontal) | no | — | — | — |
| `width` | number | no | — | — | — |
| `height` | number | no | — | — | — |
| `labels` | object | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Funnel chart example (`basic`)

```json
{
  "title": "Signup conversion",
  "steps": [
    {
      "id": "visit",
      "label": "Visits",
      "value": 800
    }
  ]
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
