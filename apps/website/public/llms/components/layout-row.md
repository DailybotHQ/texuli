# Row layout

> Children side by side, wrapping onto new lines when space runs out.

- **id:** `layout-row`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `composition`

### Use when

- Place a few items next to each other, such as KPIs or actions

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- DOM order stays reading order; the layout never reorders children visually
- Logical properties only, so right-to-left content mirrors

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `gap` | enum(none | small | medium | large) | no | — | — | Space between children. |
| `align` | enum(start | center | end | stretch) | no | — | — | — |
| `wrap` | boolean | no | — | `true` | — |
| `children` | slot | no | — | — | — |

### Examples

#### Row (`basic`)

```json
{
  "gap": "small",
  "align": "center"
}
```

### Related

- [`layout-stack`](layout-stack.md)
- [`layout-grid`](layout-grid.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
