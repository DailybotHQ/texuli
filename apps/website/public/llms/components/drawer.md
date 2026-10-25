# Drawer

> Bottom or edge drawer with optional drag dismiss.

- **id:** `drawer`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Mobile sheets that feel like drawers

### Don't use when

- Desktop side navigation (use sidebar)

### Accessibility

- Same focus model as sheet; prefer labelled titles.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg | xl) | no | — | `"md"` | — |
| `side` | enum(top | right | bottom | left | start | end | center) | no | — | `"bottom"` | — |
| `dismissOutside` | boolean | no | — | `false` | Non-modal panels only; a Drawer is modal and always dismisses outside |
| `closeOnEscape` | boolean | no | — | `false` | Non-modal panels only; a Drawer is modal and always closes on Escape |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Bottom drawer (`bottom`)

```json
{
  "side": "bottom"
}
```

### Related

- [`sheet`](sheet.md)
- [`responsive-modal`](responsive-modal.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
