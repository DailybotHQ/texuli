# Select.Item

> One selectable option inside Select.Content.

- **id:** `select-item`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Declare a Select option with value and label

### Don't use when

- A radio option outside Select (use radio)

### Accessibility

- role=option; disabled items are skipped by keyboard.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | yes | — | — | — |
| `label` | string | no | — | — | Accessible and display label when children omitted |
| `disabled` | boolean | no | — | `false` | — |
| `icon` | slot | no | — | — | — |
| `description` | string | no | — | — | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Option (`option`)

```json
{
  "value": "pro",
  "label": "Pro",
  "description": "For growing teams"
}
```

### Related

- [`select`](select.md)
- [`select-content`](select-content.md)
- [`select-group`](select-group.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
