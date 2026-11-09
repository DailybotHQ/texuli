# Separator

> A horizontal or vertical divider on the token scale.

- **id:** `separator`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Split two blocks of content visually

### Don't use when

- A menu divider (use the menu separator)
- A list item (use list-item)

### Accessibility

- Decorative by default (hidden from assistive technology); set decorative false for a semantic boundary.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `orientation` | enum(horizontal | vertical) | no | — | `"horizontal"` | — |
| `decorative` | boolean | no | — | `true` | — |
| `variant` | enum(default | subtle | strong) | no | — | `"default"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Horizontal rule (`rule`)

```json
{
  "variant": "subtle"
}
```

### Related

- [`box`](box.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
