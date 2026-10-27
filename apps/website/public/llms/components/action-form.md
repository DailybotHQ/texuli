# Action form

> Groups fields whose submit proposes one named action intent to the host.

- **id:** `action-form`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Ask the host to do something with a few named values, such as a request

### Don't use when

- Payment or sign-in: those are host regions

### Accessibility

- A labelled form; invalid fields are marked and focused; the receipt is announced

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `action` | string | yes | — | — | The action name the host receives. |
| `label` | string | yes | untrusted | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Request access (`request`)

```json
{
  "action": "request-access",
  "label": "Request access"
}
```

### Related

- [`form-field`](form-field.md)
- [`form-submit`](form-submit.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
