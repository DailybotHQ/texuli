# Schema form

> A whole form as data: typed fields in sections or steps, conditional logic, named formats and cross-field rules, painted with texuli controls; submitting proposes one action intent to the host.

- **id:** `schema-form`
- **package:** `@texuli/forms`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `schema-forms`

### Use when

- Collect structured answers: registrations, requests, surveys, intake and settings
- A multi-step flow with per-step validation, or fields that appear, become required or become editable from earlier answers

### Don't use when

- One or two values for an action: use action-form with form-field
- Payment: use a host-region. Password and one-time-code (otp) fields only where the host allows credential fields
- A filter bar over data: use control-filter or data-filter-builder

### Accessibility

- A form landmark named by its title; every control is a texuli control with a visible label, its description and its error linked
- Errors are announced, an error summary takes focus and links to each field; each new step heading takes focus and is announced
- Keyboard-complete: native order, Enter moves to the next step or submits; reduced motion makes step transitions instant

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `schema` | object | yes | — | — | The form: { title, description?, submitLabel?, fields \| sections \| steps, rules? }. Field types: text, textarea, number, email, url (protocols: ["https"] by default, ["http", "https"] to allow http), date, time, datetime (YYYY-MM-DDTHH:MM), select (clearable: an empty choice, on by default while optional), multiselect, checkbox, radio, switch, slider, file (host-handled), tags, color (#hex), password and otp (credential fields, refused unless the host allows them), and custom (painted by the host: kind must be a kind the host registered, config holds scalar settings). Rules: required, minLength, maxLength, min, max, step, minItems, maxItems, a named format (email, url, phone, postal-code…, never a pattern) and validator (a name the host registered). when.show / require / enable are expressions over earlier fields; rules[] are cross-field expressions that fail when false. |
| `action` | string | yes | — | — | The action name the host receives with the submitted values. |
| `label` | string | no | untrusted | — | Accessible name; defaults to the form title. |

### Examples

#### Access request (`request`)

```json
{
  "action": "request-access",
  "schema": {
    "title": "Request access",
    "submitLabel": "Send request",
    "fields": [
      {
        "name": "email",
        "type": "email",
        "label": "Work email",
        "required": true
      },
      {
        "name": "team",
        "type": "select",
        "label": "Team",
        "required": true,
        "options": [
          {
            "value": "design",
            "label": "Design"
          },
          {
            "value": "engineering",
            "label": "Engineering"
          }
        ]
      },
      {
        "name": "reason",
        "type": "textarea",
        "label": "Why do you need access?",
        "maxLength": 500,
        "when": {
          "require": {
            "op": "eq",
            "left": {
              "op": "field",
              "name": "team"
            },
            "right": {
              "op": "str",
              "value": "engineering"
            }
          }
        }
      }
    ]
  }
}
```

### Related

- [`action-form`](action-form.md)
- [`form-field`](form-field.md)
- [`layout-wizard`](layout-wizard.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
