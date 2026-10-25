# Field

> Label, description and error wiring for a single control.

- **id:** `field`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Compose a labeled control with optional help and error text

### Don't use when

- Standalone chrome without a form control

### Accessibility

- Generates id and aria-describedby for the control snippet
- Marks aria-invalid when error is present
- hideLabel keeps the label available to assistive tech

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | — |
| `description` | string | no | — | — | — |
| `error` | string | no | — | — | Error message; marks the control invalid |
| `required` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `id` | string | no | — | — | — |
| `hideLabel` | boolean | no | — | `false` | — |
| `orientation` | enum(vertical | horizontal) | no | — | `"vertical"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | yes | — | — | Control snippet receiving FieldControl |

### Examples

#### Vertical field (`vertical`)

```json
{
  "label": "Email",
  "description": "Work address",
  "required": true
}
```

### Related

- [`label`](label.md)
- [`description`](description.md)
- [`field-error`](field-error.md)
- [`form`](form.md)
- [`input`](input.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
