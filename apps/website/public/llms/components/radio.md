# Radio

> One option inside a RadioGroup.

- **id:** `radio`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- A single exclusive option inside radio-group

### Don't use when

- Independent toggles (use checkbox or switch)

### Accessibility

- value is required; card layout keeps the label associated with the control.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | yes | — | — | — |
| `disabled` | boolean | no | — | `false` | — |
| `id` | string | no | — | — | — |
| `label` | string | no | — | — | — |
| `description` | string | no | — | — | — |
| `size` | enum(sm | md) | no | — | `"md"` | — |
| `card` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Radio option (`option`)

```json
{
  "value": "mail",
  "label": "Email"
}
```

### Related

- [`radio-group`](radio-group.md)
- [`checkbox`](checkbox.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
