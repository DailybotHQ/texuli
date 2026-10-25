# ContextMenu.Trigger

> Region that opens the context menu.

- **id:** `context-menu-trigger`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Define the hit target for a context menu

### Don't use when

- Button menus

### Accessibility

- Region text names the menu; long-press suppresses iOS callout.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |
| `disabled` | boolean | no | — | `false` | — |

### Examples

#### Canvas region (`canvas`)

```json
{}
```

### Related

- [`context-menu`](context-menu.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
