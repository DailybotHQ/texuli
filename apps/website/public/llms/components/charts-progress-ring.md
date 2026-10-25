# Progress ring

> A compact radial progress indicator with a data table.

- **id:** `charts-progress-ring`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render progress ring from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | — |
| `description` | string | no | — | — | — |
| `value` | number | yes | — | — | — |
| `max` | number | no | — | — | — |
| `format` | object | no | — | — | — |
| `size` | number | no | — | — | — |
| `thickness` | number | no | — | — | — |
| `labels` | object | no | — | — | — |

### Examples

#### Progress ring example (`basic`)

```json
{
  "label": "Tasks complete",
  "value": 8,
  "max": 10
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
