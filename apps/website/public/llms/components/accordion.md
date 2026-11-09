# Accordion

> Stacked sections that expand and collapse one or more panels.

- **id:** `accordion`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- FAQs and grouped detail the reader opens on demand

### Don't use when

- Peer views of one page (use tabs)
- A multi-step flow (use wizard)

### Accessibility

- Each header is a button that names its panel; expanded state is exposed
- Heading level is set so the outline stays valid

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | yes | — | — | Sections: value, title, optional content |
| `type` | enum(single | multiple) | no | — | `"single"` | — |
| `value` | unknown | no | — | — | Open value or values |
| `onValueChange` | event | no | — | — | Open value changed |
| `collapsible` | boolean | no | — | `true` | — |
| `headingLevel` | number | no | — | `3` | — |
| `variant` | enum(default | bordered) | no | — | `"default"` | — |
| `disabled` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `content` | slot | no | — | — | Panel body for each item |

### Examples

#### FAQ (`faq`)

```json
{
  "headingLevel": 3,
  "items": [
    {
      "value": "hours",
      "title": "Hours",
      "content": "Weekdays 9–17."
    },
    {
      "value": "fees",
      "title": "Fees",
      "content": "No booking fee."
    }
  ]
}
```

### Related

- [`tabs`](tabs.md)
- [`stepper`](stepper.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
