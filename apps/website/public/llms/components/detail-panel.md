# DetailPanel

> Non-modal detail panel alongside content.

- **id:** `detail-panel`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Inspect a selected row without leaving the list

### Don't use when

- Full-page blocking flows (use dialog)

### Accessibility

- Keep a visible heading; do not trap focus unless modal.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg | xl) | no | — | `"md"` | — |
| `side` | enum(top | right | bottom | left | start | end | center) | no | — | `"end"` | — |
| `dismissOutside` | boolean | no | — | `false` | Non-modal only: close on a press or focus outside (never on the trigger) |
| `closeOnEscape` | boolean | no | — | `false` | Non-modal only: close on Escape anywhere, not just from inside |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### End panel (`end`)

```json
{
  "side": "end"
}
```

### Related

- [`sheet`](sheet.md)
- [`drawer`](drawer.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
