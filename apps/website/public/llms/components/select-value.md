# Select.Value

> Shows the selected label or a placeholder inside the trigger.

- **id:** `select-value`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Display the current Select value

### Don't use when

- Static text outside Select

### Accessibility

- Placeholder is visible text inside the trigger name.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `placeholder` | string | no | — | `"Select…"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Placeholder (`placeholder`)

```json
{
  "placeholder": "Choose a plan"
}
```

### Related

- [`select`](select.md)
- [`select-trigger`](select-trigger.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
