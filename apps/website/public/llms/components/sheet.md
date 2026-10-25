# Sheet

> Edge-anchored modal panel (drawer-like sheet).

- **id:** `sheet`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Mobile filters, detail rails, edge panels

### Don't use when

- Centered modal forms (use dialog)

### Accessibility

- Focus trapped while open; Escape dismisses.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg | xl) | no | — | `"md"` | — |
| `side` | enum(top | right | bottom | left | start | end | center) | no | — | `"start"` | — |
| `modal` | boolean | no | — | `true` | false: a non-modal panel (no focus trap, inert or scroll lock) |
| `dismissOutside` | boolean | no | — | `false` | Non-modal only: close on a press or focus outside (never on the trigger) |
| `closeOnEscape` | boolean | no | — | `false` | Non-modal only: close on Escape anywhere, not just from inside |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Start edge (`start`)

```json
{
  "side": "start",
  "size": "md"
}
```

### Related

- [`drawer`](drawer.md)
- [`dialog`](dialog.md)
- [`sidebar`](sidebar.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
