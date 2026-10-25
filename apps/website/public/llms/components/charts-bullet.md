# Bullet chart

> A compact value, range and target comparison.

- **id:** `charts-bullet`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render bullet chart from structured content data.

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
| `target` | number | no | — | — | — |
| `ranges` | array | no | — | — | — |
| `format` | object | no | — | — | — |
| `labels` | object | no | — | — | — |

### Examples

#### Bullet chart example (`basic`)

```json
{
  "label": "Release progress",
  "value": 68,
  "max": 100,
  "target": 75
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
