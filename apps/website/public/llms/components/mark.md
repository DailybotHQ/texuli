# Mark

> An inline highlight for search results, from role soft tokens.

- **id:** `mark`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Highlight a search match inside a title or body

### Don't use when

- A status badge (use badge)
- Struck text (use text strikethrough)

### Accessibility

- A real mark element; the words still say the match. Forced colors use Highlight.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `tone` | enum(warning | primary | success | info) | no | — | `"warning"` | — |
| `label` | string | no | — | — | Plain text, escaped |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Search hit (`search`)

```json
{
  "tone": "warning",
  "label": "quarter"
}
```

### Related

- [`text`](text.md)
- [`heading`](heading.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
