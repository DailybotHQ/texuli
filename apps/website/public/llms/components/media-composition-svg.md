# SVG composition

> A validated, structured vector composition.

- **id:** `media-composition-svg`
- **package:** `@texuli/media`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render svg composition from structured content data.

### Don't use when

- Application navigation, account controls or mutations.

### Accessibility

- Provide the required accessible title, description or text alternatives.
- Keep data available in the component-provided text or table alternative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `composition` | object | yes | — | — | — |
| `trust` | enum(developer | untrusted) | no | — | — | — |
| `title` | string | no | — | — | — |
| `description` | string | no | — | — | — |
| `validate` | boolean | no | — | — | — |
| `focusable` | boolean | no | — | — | — |
| `className` | string | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### SVG composition example (`basic`)

```json
{
  "composition": {
    "width": 320,
    "height": 180,
    "layers": []
  }
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
