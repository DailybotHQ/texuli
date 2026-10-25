# Description

> Help text associated with a field control.

- **id:** `description`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Short guidance under a label

### Don't use when

- An error message (use field-error)

### Accessibility

- Wire via aria-describedby from Field or the host.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Help text (`help`)

```json
{}
```

### Related

- [`field`](field.md)
- [`label`](label.md)
- [`field-error`](field-error.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
