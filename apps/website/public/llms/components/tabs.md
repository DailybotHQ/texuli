# Tabs

> A tab list that shows one panel at a time.

- **id:** `tabs`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Switch between peer views of the same page

### Don't use when

- A sequence of steps (use stepper or wizard)
- Mobile app destinations (use bottom-nav)

### Accessibility

- Tab list is labelled; arrow keys move among tabs; the selected tab is aria-selected
- Each tab names its panel

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | yes | — | — | Tabs: value, label, optional badge and panel |
| `value` | string | no | — | — | The selected tab value |
| `onValueChange` | event | no | — | — | Selected tab changed |
| `label` | string | no | — | — | Accessible name of the tab list |
| `variant` | enum(line | pills | enclosed) | no | — | `"line"` | — |
| `orientation` | enum(horizontal | vertical) | no | — | `"horizontal"` | — |
| `activationMode` | enum(automatic | manual) | no | — | `"automatic"` | — |
| `loop` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `content` | slot | no | — | — | Panel body for each item |

### Examples

#### Line tabs (`line`)

```json
{
  "variant": "line",
  "items": [
    {
      "value": "overview",
      "label": "Overview"
    },
    {
      "value": "activity",
      "label": "Activity"
    }
  ],
  "value": "overview"
}
```

### Related

- [`accordion`](accordion.md)
- [`stepper`](stepper.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
