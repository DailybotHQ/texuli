# FieldError

> An alert-role error message for a field.

- **id:** `field-error`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Surface a validation error next to a control

### Don't use when

- Help text that is not an error (use description)

### Accessibility

- role=alert; show=false renders nothing while the host keeps aria wiring.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `show` | boolean | no | — | `true` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Error message (`message`)

```json
{
  "show": true
}
```

### Related

- [`field`](field.md)
- [`form`](form.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
