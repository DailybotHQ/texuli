# Form submit

> Proposes the form's action with its fields' values; disabled while a receipt is pending.

- **id:** `form-submit`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- The one primary action of an action-form

### Don't use when

- Navigation or local view changes: use flow-action

### Accessibility

- A submit button inside the form; Enter in a field submits too

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | — |

### Examples

#### Send (`send`)

```json
{
  "label": "Send request"
}
```

### Related

- [`action-form`](action-form.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
