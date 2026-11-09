# Carousel

> A labelled region of slides with previous, next and a picker.

- **id:** `carousel`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- A few slides the person pages through, such as quotes or screenshots

### Don't use when

- A gallery of images with a lightbox (use media-image)
- Tabs (use tabs)

### Accessibility

- APG carousel: a named region, arrow keys, and a tablist when dots are shown.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | yes | — | — | { id, label }[] in display order |
| `index` | number | no | — | `0` | — |
| `label` | string | no | — | — | — |
| `showControls` | boolean | no | — | `true` | — |
| `showDots` | boolean | no | — | `true` | — |
| `controls` | enum(below | overlay) | no | — | `"below"` | — |
| `loop` | boolean | no | — | `true` | — |
| `class` | string | no | — | — | — |

### Examples

#### Quotes (`quotes`)

```json
{
  "label": "Customer quotes",
  "items": [
    {
      "id": "a",
      "label": "Ada Example"
    },
    {
      "id": "b",
      "label": "Lin Example"
    }
  ]
}
```

### Related

- [`card`](card.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
