# TextCounter

> An input or textarea that shows remaining characters near the limit.

- **id:** `text-counter`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Bounded free-text with a visible remaining count

### Don't use when

- Unbounded text without a max length

### Accessibility

- Remaining count is exposed via aria-describedby while focused near the limit.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | — | — | — |
| `tag` | enum(input | textarea) | no | — | `"input"` | — |
| `type` | string | no | — | `"text"` | — |
| `id` | string | no | — | — | — |
| `name` | string | no | — | — | — |
| `label` | string | no | — | — | — |
| `placeholder` | string | no | — | — | — |
| `maxlength` | number | no | — | `256` | — |
| `showAfter` | number | no | — | `20` | Show the count once this many characters remain |
| `rows` | number | no | — | `3` | — |
| `disabled` | boolean | no | — | `false` | — |
| `readonly` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `invalid` | boolean | no | — | `false` | — |
| `autosize` | boolean | no | — | `false` | — |
| `remainingLabel` | string | no | — | `"characters left"` | — |
| `onValueChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Near limit (`near-limit`)

```json
{
  "maxlength": 80,
  "showAfter": 20,
  "label": "Summary"
}
```

### Related

- [`input`](input.md)
- [`textarea`](textarea.md)
- [`field`](field.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
