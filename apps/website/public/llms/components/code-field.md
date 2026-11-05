# CodeField

> An editable, syntax-highlighted code textarea.

- **id:** `code-field`
- **package:** `@texuli/blocks`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Edit a snippet or query

### Don't use when

- Read-only code (use blocks-code)

### Accessibility

- A real textarea; Tab indents, Escape then Tab leaves.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | untrusted | — | — |
| `language` | string | no | — | — | ts, python, yml… |
| `label` | string | no | — | — | — |
| `labels` | object | no | — | — | — |
| `placeholder` | string | no | — | — | — |
| `name` | string | no | — | — | — |
| `readonly` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `rows` | number | no | — | `4` | — |
| `wrap` | boolean | no | — | `false` | — |
| `tabSize` | number | no | — | `2` | — |
| `indentWith` | enum(spaces | tab) | no | — | `"spaces"` | — |
| `lineNumbers` | boolean | no | — | `false` | — |
| `highlightLimit` | number | no | — | — | — |
| `showKeyboardHint` | boolean | no | — | `false` | — |
| `onValueChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### SQL (`sql`)

```json
{
  "language": "sql",
  "value": "select 1;"
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
