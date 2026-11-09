# Color swatch

> A chip of a closed palette, role or data-viz color with contrast ink from tokens. Never free CSS.

- **id:** `color-swatch`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show a named token or series color in a legend, key or palette

### Don't use when

- A status label (use badge)
- A long-form color name in a sentence (use text)

### Accessibility

- Pair the fill with a text label; never convey the color by fill alone.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `color` | enum(chart-1 | chart-2 | chart-3 | chart-4 | chart-5 | chart-6 | chart-7 | chart-8 | primary | secondary | success | warning | destructive | info | neutral) | no | — | `"primary"` | Closed color reference (chart-1…8 or a role token) |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `label` | string | no | — | — | Plain-text label, escaped |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | Rich label content; replaced by a non-empty label |

### Examples

#### Primary swatch (`primary`)

```json
{
  "color": "primary",
  "label": "Primary"
}
```

#### Chart series (`series`)

```json
{
  "color": "chart-1",
  "size": "md",
  "label": "North"
}
```

### Related

- [`badge`](badge.md)
- [`box`](box.md)
- [`text`](text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
