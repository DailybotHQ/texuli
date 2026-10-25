# HoverCard

> Preview panel that opens on hover or focus.

- **id:** `hover-card`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Rich previews without a click

### Don't use when

- Required interactions (use popover or dialog)

### Accessibility

- Opens on focus as well as hover; dismissible.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `children` | slot | no | — | — | — |

### Examples

#### Preview (`preview`)

```json
{}
```

### Related

- [`popover`](popover.md)
- [`tooltip`](tooltip.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
