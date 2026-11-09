# NumberField

> A numeric value with optional steppers, min, max and locale formatting.

- **id:** `number-field`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- A quantity, amount or count the person types or steps

### Don't use when

- A time of day (use time-field)
- A PIN or code (use pin-input)

### Accessibility

- A labelled spinbutton; steppers are named Increment and Decrement.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | number | no | — | — | The value, or null when empty (bind:value) |
| `min` | number | no | — | — | — |
| `max` | number | no | — | — | — |
| `step` | number | no | — | `1` | — |
| `disabled` | boolean | no | — | `false` | — |
| `readOnly` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `name` | string | no | — | — | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `display` | enum(input | output) | no | — | `"input"` | — |
| `commit` | enum(enter | blur | input) | no | — | `"enter"` | When typed text commits: Enter and blur, blur only, or every keystroke |
| `onValueChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Quantity (`quantity`)

```json
{
  "value": 2,
  "min": 0,
  "max": 99,
  "name": "qty"
}
```

### Related

- [`field`](field.md)
- [`input`](input.md)
- [`pin-input`](pin-input.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
