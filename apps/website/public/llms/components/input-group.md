# InputGroup

> An input with start/end adornments and optional clear.

- **id:** `input-group`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Inputs with a unit, icon or trailing action

### Don't use when

- A bare input with no adornment (use input)

### Accessibility

- Invalid state marks the control aria-invalid; clear has an accessible name.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `start` | slot | no | — | — | Start adornment |
| `end` | slot | no | — | — | End adornment |
| `inputProps` | object | no | — | — | Native attributes for the inner input |
| `value` | string | no | — | — | — |
| `ref` | unknown | no | — | — | — |
| `disabled` | boolean | no | — | `false` | — |
| `readonly` | boolean | no | — | `false` | — |
| `invalid` | boolean | no | — | `false` | — |
| `clearable` | boolean | no | — | `false` | — |
| `clearLabel` | string | no | — | `"Clear"` | — |
| `onValueChange` | event | no | — | — | — |
| `onClear` | event | no | — | — | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Search group (`search`)

```json
{
  "clearable": true
}
```

### Related

- [`input`](input.md)
- [`field`](field.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
