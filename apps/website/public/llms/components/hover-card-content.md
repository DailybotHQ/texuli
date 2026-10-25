# HoverCard.Content

> Styled hover-card surface.

- **id:** `hover-card-content`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Body of a hover card

### Don't use when

- Click-toggled panels (use popover-content)

### Accessibility

- Same surface tokens as popover for contrast.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `variant` | enum(elevated | flat) | no | — | `"elevated"` | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `arrow` | boolean | no | — | `true` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Content (`body`)

```json
{}
```

### Related

- [`hover-card`](hover-card.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
