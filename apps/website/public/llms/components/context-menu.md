# ContextMenu

> Pointer-anchored menu (right-click, long-press, Menu key).

- **id:** `context-menu`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Actions on a canvas or list row via context click

### Don't use when

- A visible button trigger (use dropdown-menu)

### Accessibility

- Opens at the pointer; keyboard Menu/Shift+F10 supported on the region.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Context region (`region`)

```json
{}
```

### Related

- [`dropdown-menu`](dropdown-menu.md)
- [`context-menu-trigger`](context-menu-trigger.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
