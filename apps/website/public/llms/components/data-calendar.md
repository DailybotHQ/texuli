# Calendar

> Events on a month, week, day or agenda view; people open, and when allowed move, events.

- **id:** `data-calendar`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Show scheduled events or availability over days and weeks

### Don't use when

- Task durations and dependencies: use data-timeline
- One date: use text

### Accessibility

- A labelled grid with roving focus; every event is a button with its time and title
- Moving an event has a keyboard path; changes are announced politely

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `events` | array | yes | — | — | — |
| `view` | enum(month | week | day | agenda) | no | — | `"week"` | — |
| `anchor` | string | no | — | — | The ISO date the view opens on. |
| `timeZone` | string | no | — | `"UTC"` | — |
| `locale` | string | no | — | `"en-US"` | — |
| `readOnly` | boolean | no | — | `false` | — |

### Examples

#### Team week (`week`)

```json
{
  "label": "Team calendar",
  "view": "week",
  "anchor": "2026-10-26",
  "events": [
    {
      "id": "e1",
      "title": "Planning",
      "start": "2026-10-26T09:00:00Z",
      "end": "2026-10-26T10:00:00Z"
    },
    {
      "id": "e2",
      "title": "Offsite",
      "start": "2026-10-29",
      "end": "2026-10-30",
      "allDay": true
    }
  ]
}
```

### Related

- [`data-timeline`](data-timeline.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
