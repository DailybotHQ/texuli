# RadioGroup

> A set of exclusive radio options with keyboard roving.

- **id:** `radio-group`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Pick exactly one option from a short closed set

### Don't use when

- Many options with search (use select or combobox)
- Independent toggles

### Accessibility

- Arrow keys move focus; Space selects; loop wraps at the ends.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | — | — | — |
| `onValueChange` | event | no | — | — | — |
| `name` | string | no | — | — | — |
| `required` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `readonly` | boolean | no | — | `false` | — |
| `orientation` | enum(vertical | horizontal) | no | — | `"vertical"` | — |
| `variant` | enum(default | card) | no | — | `"default"` | — |
| `size` | enum(sm | md) | no | — | `"md"` | — |
| `items` | array | no | — | — | Convenience option list; use children with Radio for custom layouts |
| `loop` | boolean | no | — | `true` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Vertical group (`vertical`)

```json
{
  "orientation": "vertical",
  "items": [
    {
      "value": "mail",
      "label": "Email"
    },
    {
      "value": "sms",
      "label": "SMS"
    }
  ]
}
```

### Related

- [`radio`](radio.md)
- [`select`](select.md)
- [`checkbox`](checkbox.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
