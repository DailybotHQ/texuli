# Heading

> A page title or section heading: a semantic h1–h6 with a size from the type scale.

- **id:** `heading`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Title a page, a section or a panel
- Keep visual hierarchy in a locked prototype, where typography utilities are refused

### Don't use when

- Body copy, labels or captions (use text)
- Long-form content (use prose)

### Accessibility

- Renders the semantic heading element for its level; pick levels in document order.
- size changes only the look, never the level announced to assistive technology.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `level` | number | no | — | `2` | The semantic level, 1 to 6: renders <h1>…<h6> |
| `size` | enum(display | xl | lg | md | sm) | no | — | `"lg"` | Visual size, independent of the level (default from the level: 1 xl, 2 lg, 3 md, 4–6 sm) |
| `tone` | enum(default | muted) | no | — | `"default"` | — |
| `truncate` | boolean | no | — | `false` | One line with an ellipsis |
| `label` | string | no | — | — | Plain-text heading, escaped; replaces children when both are given |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | The heading text |

### Examples

#### Page title (`page-title`)

```json
{
  "level": 1,
  "size": "xl",
  "label": "Quarterly report"
}
```

#### Muted section heading (`section`)

```json
{
  "level": 2,
  "size": "md",
  "tone": "muted",
  "label": "Details"
}
```

### Related

- [`text`](text.md)
- [`prose`](prose.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
