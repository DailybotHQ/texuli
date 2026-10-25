# DropdownMenu.Content

> Floating menu surface for dropdown items.

- **id:** `dropdown-menu-content`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Host menu items under a dropdown trigger

### Don't use when

- Non-menu floating panels (use popover)

### Accessibility

- role=menu; labelled by the trigger.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `variant` | enum(default | soft) | no | — | `"default"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |
| `side` | enum(top | right | bottom | left) | no | — | `"bottom"` | — |
| `align` | enum(start | center | end) | no | — | `"start"` | — |
| `sideOffset` | number | no | — | `4` | — |

### Examples

#### Content (`panel`)

```json
{
  "size": "md"
}
```

### Related

- [`dropdown-menu`](dropdown-menu.md)
- [`dropdown-menu-item`](dropdown-menu-item.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
