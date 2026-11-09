# Box

> A panel or region with layout options and token-based surface or color-reference fill.

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
| `border` | enum(none | default | strong | block-start | block-end | inline-start | inline-end | dashed) | no | — | `"none"` | All sides, one logical side (block-start, block-end, inline-start, inline-end), or dashed |
| `elevation` | enum(none | sm | md | lg) | no | — | `"none"` | — |
| `surface` | enum(transparent | default | muted | subtle | elevated | canvas | primary | brand | success | warning | destructive | info | primary-soft | translucent) | no | — | `"transparent"` | The surface (the variant axis): primary is solid, the semantic tones and primary-soft use soft token fills with AA ink, and translucent is glass for sticky headers |
| `fill` | enum(none | chart-1 | chart-2 | chart-3 | chart-4 | chart-5 | chart-6 | chart-7 | chart-8 | primary | secondary | success | warning | destructive | info | neutral) | no | — | `"none"` | Optional closed token reference (chart-1 through chart-8 or a semantic color role); never a CSS color or arbitrary value |
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

#### Brand logo tile (`logo-tile`)

```json
{
  "padding": "md",
  "radius": "lg",
  "surface": "primary"
}
```

#### Page canvas (`page-canvas`)

```json
{
  "as": "div",
  "padding": "lg",
  "radius": "none",
  "surface": "canvas"
}
```

#### Translucent sticky header (`sticky-header`)

```json
{
  "as": "header",
  "padding": "md",
  "radius": "none",
  "border": "block-end",
  "surface": "translucent"
}
```

#### Dashed panel (`dashed`)

```json
{
  "padding": "md",
  "border": "dashed",
  "surface": "default"
}
```

### Related

- [`card`](card.md)
- [`heading`](heading.md)
- [`text`](text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
