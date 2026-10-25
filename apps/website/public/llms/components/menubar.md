# Menubar

> Application menubar with roving top-level items.

- **id:** `menubar`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Desktop-style File/Edit/View bars

### Don't use when

- A single actions button (use dropdown-menu)

### Accessibility

- role=menubar; one Tab stop; arrows move between menus.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | — | — | Open menu value or empty |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |
| `loop` | boolean | no | — | `true` | — |
| `dir` | enum(ltr | rtl) | no | — | — | — |

### Examples

#### Application bar (`app`)

```json
{
  "value": "file"
}
```

### Related

- [`menubar-trigger`](menubar-trigger.md)
- [`dropdown-menu`](dropdown-menu.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
