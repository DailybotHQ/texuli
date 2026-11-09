# Box

> A panel or region with padding, radius, border, elevation and surface from tokens.

- **id:** `box`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Frame a group of content as a bordered or filled panel
- Space and surface a region in a locked prototype, where visual utilities are refused

### Don't use when

- A clickable surface (use card with href)
- Page layout (use a layout)

### Accessibility

- Not interactive. Use as="section" or "aside" with a heading for a landmark-like region.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `as` | enum(div | section | article | aside | header | footer) | no | — | `"div"` | — |
| `padding` | enum(none | sm | md | lg | xl) | no | — | `"md"` | — |
| `radius` | enum(none | sm | md | lg | xl | full) | no | — | `"md"` | — |
| `border` | enum(none | default | strong | block-start | block-end) | no | — | `"none"` | All sides, or one logical side (block-start, block-end) for an app header or footer |
| `elevation` | enum(none | sm | md | lg) | no | — | `"none"` | — |
| `surface` | enum(transparent | default | muted | subtle | elevated) | no | — | `"transparent"` | The fill (the variant axis) |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | The panel content |

### Examples

#### Bordered panel (`bordered`)

```json
{
  "padding": "lg",
  "border": "default",
  "surface": "default"
}
```

#### Muted region (`muted`)

```json
{
  "padding": "md",
  "radius": "lg",
  "surface": "muted"
}
```

#### App header (no card chrome) (`app-header`)

```json
{
  "as": "header",
  "padding": "md",
  "radius": "none",
  "border": "block-end",
  "surface": "default"
}
```

### Related

- [`card`](card.md)
- [`heading`](heading.md)
- [`text`](text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
