# DropdownMenu

> Menu button pattern with items, checkboxes, radios and submenus.

- **id:** `dropdown-menu`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Actions behind a button trigger
- Menus with keyboard typeahead

### Don't use when

- Top-level app menus (use menubar)
- Pointer-anchored region menus (use context-menu)

### Accessibility

- APG menu button: arrow keys, typeahead, Escape closes and restores focus.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Actions menu (`actions`)

```json
{
  "open": true
}
```

### Related

- [`context-menu`](context-menu.md)
- [`menubar`](menubar.md)
- [`dropdown-menu-item`](dropdown-menu-item.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
