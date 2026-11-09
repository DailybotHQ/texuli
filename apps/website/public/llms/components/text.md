# Text

> Body copy, labels and small print with a size, tone and weight from the design system.

- **id:** `text`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Body text, helper text, captions, muted or small print
- Text with a status ink (success, warning, destructive, info) next to a word that says it

### Don't use when

- A title or section heading (use heading)
- Long-form content (use prose)

### Accessibility

- Never renders a heading element: as is p, span, div, label, small or strong.
- A tone never carries meaning alone; the words say it.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `as` | enum(p | span | div | label | small | strong) | no | — | `"p"` | — |
| `size` | enum(figure | lg | md | sm | xs) | no | — | `"md"` | figure is a large number outside stat (the title size of the type scale) |
| `tone` | enum(default | muted | subtle | primary | success | warning | destructive | info) | no | — | `"default"` | — |
| `weight` | enum(regular | medium | semibold) | no | — | `"regular"` | — |
| `truncate` | boolean | no | — | `false` | One line with an ellipsis |
| `lineClamp` | number | no | — | — | Clamp to 1 to 10 lines with an ellipsis |
| `align` | enum(start | center | end) | no | — | `"start"` | — |
| `mono` | boolean | no | — | `false` | The design system's code family |
| `tabular` | boolean | no | — | `false` | Tabular figures (font-variant-numeric: tabular-nums) for numbers that line up |
| `transform` | enum(none | uppercase | lowercase | capitalize) | no | — | `"none"` | — |
| `tracking` | enum(normal | wide) | no | — | `"normal"` | Letter spacing; wide is the eyebrow tracking (--tx-letter-spacing-wide) |
| `for` | string | no | — | — | With as="label": the id of the labelled control |
| `label` | string | no | — | — | Plain text, escaped; replaces children when both are given |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | The text |

### Examples

#### Muted helper text (`muted`)

```json
{
  "size": "sm",
  "tone": "muted",
  "label": "Updated an hour ago"
}
```

#### Small print (`caption`)

```json
{
  "as": "small",
  "size": "xs",
  "tone": "subtle",
  "label": "Prices exclude tax."
}
```

#### Eyebrow (overline) (`eyebrow`)

```json
{
  "as": "span",
  "size": "xs",
  "tone": "muted",
  "transform": "uppercase",
  "tracking": "wide",
  "label": "Revenue"
}
```

#### Large figure (`figure`)

```json
{
  "as": "span",
  "size": "figure",
  "tabular": true,
  "label": "1,284"
}
```

### Related

- [`heading`](heading.md)
- [`prose`](prose.md)
- [`inline-text`](inline-text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
