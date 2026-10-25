# AppNav

> Desktop sidebar shell with mobile sheet drawer and main slot.

- **id:** `app-nav`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Full app chrome with responsive navigation

### Don't use when

- Sidebar alone inside a custom shell

### Accessibility

- Menu button opens a labelled sheet; main has a stable id.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | no | — | — | — |
| `sections` | array | no | — | — | — |
| `collapsed` | boolean | no | — | `false` | — |
| `collapsible` | boolean | no | — | `true` | — |
| `variant` | enum(default | inset) | no | — | `"default"` | — |
| `header` | slot | no | — | — | — |
| `footer` | slot | no | — | — | — |
| `itemIcon` | slot | no | — | — | — |
| `children` | slot | no | — | — | — |
| `topBar` | slot | no | — | — | — |
| `label` | string | no | — | `"Main"` | — |
| `menuLabel` | string | no | — | `"Open navigation"` | — |
| `drawerTitle` | string | no | — | `"Navigation"` | — |
| `hrefTrust` | enum(developer | untrusted) | no | developer | `"developer"` | — |
| `mobileOpen` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |

### Examples

#### App shell (`shell`)

```json
{
  "label": "Main"
}
```

### Related

- [`sidebar`](sidebar.md)
- [`sheet`](sheet.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
