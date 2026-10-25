# DropdownMenu.Trigger

> Styled button that opens a dropdown menu.

- **id:** `dropdown-menu-trigger`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Label the control that opens DropdownMenu

### Don't use when

- Context or menubar triggers

### Accessibility

- aria-haspopup=menu and aria-expanded track open state.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `variant` | enum(default | soft) | no | — | `"default"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Trigger (`default`)

```json
{
  "variant": "default"
}
```

### Related

- [`dropdown-menu`](dropdown-menu.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
