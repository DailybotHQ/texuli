# Stack layout

> Children in one column, in reading order, with a fixed gap.

- **id:** `layout-stack`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `composition`

### Use when

- Group content vertically with consistent spacing

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- DOM order stays reading order; the layout never reorders children visually
- Logical properties only, so right-to-left content mirrors

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `gap` | enum(none | small | medium | large) | no | — | — | Space between children. |
| `children` | slot | no | — | — | — |

### Examples

#### Stack (`basic`)

```json
{
  "gap": "medium"
}
```

### Related

- [`layout-row`](layout-row.md)
- [`layout-split`](layout-split.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
