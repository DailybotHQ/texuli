# Area chart

> A categorical area chart with an accessible data table.

- **id:** `charts-area`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render area chart from structured content data.

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

#### Area chart example (`basic`)

```json
{
  "title": "Weekly activity",
  "description": "Activity by week",
  "series": []
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
