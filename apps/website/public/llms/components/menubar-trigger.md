# Menubar.Trigger

> Top-level menubar item that opens a menu.

- **id:** `menubar-trigger`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Label a menubar menu

### Don't use when

- Dropdown button triggers

### Accessibility

- role=menuitem with aria-haspopup=menu.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `variant` | enum(default | soft) | no | — | `"default"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |
| `disabled` | boolean | no | — | `false` | — |

### Examples

#### File (`file`)

```json
{}
```

### Related

- [`menubar`](menubar.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
