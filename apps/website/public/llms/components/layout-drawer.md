# LayoutDrawer

> Mobile navigation drawer built on the dialog primitive.

- **id:** `layout-drawer`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Narrow layouts that hide primary nav behind a menu

### Don't use when

- Desktop-only sidebars

### Accessibility

- Drawer is a labelled dialog
- Close control is named

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `label` | string | yes | — | — | Accessible drawer name |
| `closeLabel` | string | no | — | `"Close navigation"` | — |
| `children` | slot | no | — | — | — |

### Examples

#### Open drawer (`open`)

```json
{
  "open": true,
  "label": "Navigation"
}
```

### Related

- [`layout-sidebar`](layout-sidebar.md)
- [`dialog`](dialog.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
