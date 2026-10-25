# Checkbox

> A binary or indeterminate checkbox with optional label.

- **id:** `checkbox`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Independent on/off choices
- Select-all with indeterminate

### Don't use when

- A single exclusive choice in a set (use radio-group)
- A switch-style setting (use switch)

### Accessibility

- Visible label is wired with for; description uses aria-describedby.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `checked` | boolean | no | — | `false` | — |
| `defaultChecked` | boolean | no | — | `false` | — |
| `indeterminate` | boolean | no | — | `false` | — |
| `defaultIndeterminate` | boolean | no | — | `false` | — |
| `name` | string | no | — | — | — |
| `value` | string | no | — | `"on"` | — |
| `disabled` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `id` | string | no | — | — | — |
| `label` | string | no | — | — | — |
| `description` | string | no | — | — | — |
| `size` | enum(sm | md) | no | — | `"md"` | — |
| `onCheckedChange` | event | no | — | — | — |
| `onIndeterminateChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Labeled checkbox (`labeled`)

```json
{
  "label": "Subscribe to updates"
}
```

#### Indeterminate (`indeterminate`)

```json
{
  "indeterminate": true,
  "label": "Select all"
}
```

### Related

- [`switch`](switch.md)
- [`radio-group`](radio-group.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
