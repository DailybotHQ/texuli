# Cartesian chart

> The general line, area, bar, stacked bar or combo chart renderer.

- **id:** `charts-cartesian`
- **package:** `@texuli/charts`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render cartesian chart from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `kind` | enum(line | area | bar | stacked-bar | combo) | yes | — | — | — |
| `title` | string | yes | — | — | — |
| `description` | string | yes | — | — | — |
| `series` | array | yes | — | — | — |
| `mode` | enum(light | dark) | no | — | — | — |
| `class` | string | no | — | — | — |
| `renderer` | enum(svg | canvas | auto) | no | — | — | — |
| `interactive` | string | no | — | — | — |
| `fullDomain` | string | no | — | — | — |
| `visibleDomain` | string | no | — | — | — |
| `annotations` | string | no | — | — | — |

### Examples

#### Cartesian chart example (`basic`)

```json
{
  "kind": "line",
  "title": "Weekly activity",
  "description": "Activity by week",
  "series": []
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
