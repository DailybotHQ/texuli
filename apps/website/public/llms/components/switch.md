# Switch

> An immediate on/off setting control.

- **id:** `switch`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Settings that take effect immediately

### Don't use when

- A form agreement that must be submitted (use checkbox)

### Accessibility

- role=switch with aria-checked; label wires the accessible name.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `checked` | boolean | no | — | `false` | — |
| `defaultChecked` | boolean | no | — | `false` | — |
| `name` | string | no | — | — | — |
| `value` | string | no | — | `"on"` | — |
| `disabled` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `id` | string | no | — | — | — |
| `label` | string | no | — | — | — |
| `description` | string | no | — | — | — |
| `size` | enum(sm | md) | no | — | `"md"` | — |
| `onCheckedChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Labeled switch (`labeled`)

```json
{
  "label": "Dark mode",
  "checked": true
}
```

### Related

- [`checkbox`](checkbox.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
