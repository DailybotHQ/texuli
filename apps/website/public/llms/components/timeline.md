# Timeline

> Vertical or horizontal chronological list of events.

- **id:** `timeline`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show a sequence of events with status

### Don't use when

- A Gantt schedule with dependencies (use @texuli/data/timeline)

### Accessibility

- Ordered list with an accessible name
- Status has a spoken word and marker shape, not color alone
- Item links pass the URL policy

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | no | — | — | Data-driven items (or compose TimelineItem children) |
| `orientation` | enum(vertical | horizontal) | no | — | `"vertical"` | — |
| `label` | string | no | — | — | — |
| `messages` | object | no | — | — | Localized label/status words |
| `hrefTrust` | enum(developer | untrusted) | no | — | `"developer"` | — |
| `item` | slot | no | — | — | Extra content under each data item |
| `class` | string | no | — | — | — |

### Examples

#### Shipment timeline (`shipment`)

```json
{
  "orientation": "vertical",
  "items": [
    {
      "id": "1",
      "title": "Packed",
      "time": "Mon",
      "status": "complete"
    },
    {
      "id": "2",
      "title": "In transit",
      "time": "Tue",
      "status": "current"
    },
    {
      "id": "3",
      "title": "Delivered",
      "time": "Wed",
      "status": "upcoming"
    }
  ]
}
```

### Related

- [`stepper`](stepper.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
