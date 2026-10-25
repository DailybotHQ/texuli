# Canvas composition

> A validated layered composition rendered to a canvas.

- **id:** `media-composition-canvas`
- **package:** `@texuli/media`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `content`

### Use when

- Render canvas composition from structured content data.

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
| `label` | string | no | — | — | — |
| `labels` | object | no | — | — | — |
| `pixelRatio` | number | no | — | — | — |
| `dir` | enum(ltr | rtl) | no | — | — | — |
| `fontFamily` | string | no | — | — | — |
| `background` | string | no | — | — | — |
| `loadImage` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |
| `onrender` | event | no | — | — | Host-provided callback; omit when no host behavior is needed. |

### Examples

#### Canvas composition example (`basic`)

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
