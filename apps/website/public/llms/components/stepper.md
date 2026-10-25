# Stepper

> Horizontal or vertical progress through ordered steps.

- **id:** `stepper`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show multi-step onboarding or checkout progress

### Don't use when

- A chronological event log (use timeline)

### Accessibility

- nav with an accessible name; current step is announced; completed steps may be activatable.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `steps` | array | yes | — | — | Array of { id, label, description? } |
| `current` | number | yes | — | — | 0-based active index |
| `completed` | array | no | — | — | Ids of completed steps |
| `orientation` | enum(horizontal | vertical) | no | — | `"horizontal"` | — |
| `onStepClick` | event | no | — | — | — |
| `label` | string | no | — | `"Progress"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Checkout steps (`checkout`)

```json
{
  "current": 1,
  "orientation": "horizontal",
  "steps": [
    {
      "id": "cart",
      "label": "Cart"
    },
    {
      "id": "ship",
      "label": "Shipping"
    },
    {
      "id": "pay",
      "label": "Payment"
    }
  ]
}
```

### Related

- [`timeline`](timeline.md)
- [`layout-wizard`](layout-wizard.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
