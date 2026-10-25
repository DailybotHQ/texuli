# Form

> A form shell with layout, validation hook and error map.

- **id:** `form`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Collect and validate a set of fields before submit

### Don't use when

- A single control with no submit (use field alone)

### Accessibility

- Native constraint validation runs unless noValidate is set
- Field errors map back onto controls after onValidate

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `layout` | enum(stack | grid) | no | — | `"stack"` | — |
| `noValidate` | boolean | no | — | `false` | — |
| `onValidate` | event | no | — | — | Return a field→message map (or Promise) to block submit |
| `onSubmitValues` | event | no | — | — | Called after validation succeeds with FormData values |
| `errors` | object | no | — | — | Controlled field→message map (bind:errors) |
| `onErrorsChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |
| `formError` | slot | no | — | — | Form-level error snippet (e.g. _form message) |

### Examples

#### Stacked form (`stack`)

```json
{
  "layout": "stack"
}
```

### Related

- [`field`](field.md)
- [`button`](button.md)
- [`input`](input.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
