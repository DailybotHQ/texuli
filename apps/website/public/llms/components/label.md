# Label

> A form label with optional required marker and sr-only mode.

- **id:** `label`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Label a control outside Field

### Don't use when

- A full field stack (use field)

### Accessibility

- srOnly keeps the label for assistive tech while hiding it visually.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `required` | boolean | no | — | `false` | — |
| `size` | enum(sm | md) | no | — | `"md"` | — |
| `srOnly` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | The label text (an inline-text node in a tree) |

### Examples

#### Required label (`required`)

```json
{
  "required": true
}
```

### Related

- [`field`](field.md)
- [`description`](description.md)
- [`inline-text`](inline-text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
