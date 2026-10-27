# Split layout

> Two panes side by side at a fixed ratio, stacked on narrow screens.

- **id:** `layout-split`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `composition`

### Use when

- Show a primary pane with a supporting pane, such as text beside a chart

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- DOM order stays reading order; the layout never reorders children visually
- Logical properties only, so right-to-left content mirrors

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `ratio` | enum(1:1 | 1:2 | 2:1 | 1:3 | 3:1) | no | — | `"1:1"` | — |
| `gap` | enum(none | small | medium | large) | no | — | — | Space between children. |
| `children` | slot | no | — | — | — |

### Examples

#### Split (`basic`)

```json
{
  "ratio": "2:1"
}
```

### Related

- [`layout-row`](layout-row.md)
- [`layout-grid`](layout-grid.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
