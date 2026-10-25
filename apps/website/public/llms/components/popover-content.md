# Popover.Content

> Styled popover surface with optional arrow.

- **id:** `popover-content`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Body of a popover

### Don't use when

- Menu lists (use dropdown-menu-content)

### Accessibility

- Provide a visible heading or aria-label when needed.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `variant` | enum(elevated | flat) | no | — | `"elevated"` | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `arrow` | boolean | no | — | `true` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |
| `side` | enum(top | right | bottom | left) | no | — | `"bottom"` | — |
| `align` | enum(start | center | end) | no | — | `"center"` | — |
| `sideOffset` | number | no | — | `8` | — |
| `initialFocus` | unknown | no | — | — | An element inside the content, or a function returning one, to focus on open (for example the selected date). Falls back to the first control, else the content. Host-only: not agent-emittable (elements and functions are not data). |

### Examples

#### Elevated (`elevated`)

```json
{
  "variant": "elevated"
}
```

### Related

- [`popover`](popover.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
