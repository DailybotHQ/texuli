# DropdownMenu.Item

> Menu item with optional icon and shortcut chrome.

- **id:** `dropdown-menu-item`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- A single actionable row inside a menu

### Don't use when

- Standalone buttons outside a menu

### Accessibility

- role=menuitem; shortcuts are visual only.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `disabled` | boolean | no | — | `false` | — |
| `textValue` | string | no | — | — | Typeahead text override |
| `onSelect` | event | no | — | — | — |
| `closeOnSelect` | boolean | no | — | `true` | — |
| `icon` | slot | no | — | — | — |
| `shortcut` | string | no | — | — | Displayed keyboard hint |
| `inset` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Item with shortcut (`with-shortcut`)

```json
{
  "shortcut": "⌘N"
}
```

### Related

- [`dropdown-menu`](dropdown-menu.md)
- [`context-menu`](context-menu.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
