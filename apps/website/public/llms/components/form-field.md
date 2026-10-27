# Form field

> A named, validated field bound to a declared local-state variable.

- **id:** `form-field`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Collect one value for an action

### Don't use when

- Passwords, card numbers or one-time codes: never in a blueprint

### Accessibility

- A visible label; required and invalid states are exposed; errors are linked

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `name` | string | yes | — | — | The key in the action values. |
| `state` | string | yes | — | — | The declared variable it binds. |
| `label` | string | yes | untrusted | — | — |
| `kind` | enum(text | email | tel | number | multiline) | no | — | `"text"` | — |
| `required` | boolean | no | — | — | — |
| `autocomplete` | enum(off | name | given-name | family-name | nickname | email | tel | organization | organization-title | street-address | address-level1 | address-level2 | postal-code | country-name | language | url) | no | — | — | — |
| `pattern` | enum(email | phone | postal-code | digits | slug) | no | — | — | — |
| `minLength` | number | no | — | — | — |
| `maxLength` | number | no | — | — | — |
| `min` | number | no | — | — | — |
| `max` | number | no | — | — | — |
| `placeholder` | string | no | untrusted | — | — |

### Examples

#### Email (`email`)

```json
{
  "name": "email",
  "state": "email",
  "label": "Email",
  "kind": "email",
  "required": true
}
```

### Related

- [`action-form`](action-form.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
