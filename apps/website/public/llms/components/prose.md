# Prose

> Long-form text with the design system's reading rhythm: measure, spacing, headings, lists.

- **id:** `prose`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Articles, docs, descriptions and other long text written as markup

### Don't use when

- One line or a short label (use text)
- A block document (use document)

### Accessibility

- Keeps the host markup and its semantics; a 65ch measure keeps lines readable.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `as` | enum(div | article | section) | no | — | `"div"` | — |
| `size` | enum(md | lg) | no | — | `"md"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | The long-form markup (paragraphs, headings, lists) |

### Examples

#### Article body (`article`)

```json
{
  "as": "article",
  "size": "md"
}
```

### Related

- [`heading`](heading.md)
- [`text`](text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
