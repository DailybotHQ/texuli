# PinInput

> A one-time code of fixed length, one cell per character.

- **id:** `pin-input`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- A short confirmation or PIN the person types

### Don't use when

- A free numeric quantity (use number-field)

### Accessibility

- One real input; cells are presentational. Paste fills every cell.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | — | — | The code so far (bind:value) |
| `maxlength` | number | no | — | `4` | — |
| `mask` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `onValueChange` | event | no | — | — | — |
| `onComplete` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### One-time code (`otp`)

```json
{
  "maxlength": 6
}
```

### Related

- [`field`](field.md)
- [`input`](input.md)
- [`number-field`](number-field.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
