# Project timeline

> Tasks as bars over days, weeks, months or quarters, with dependencies and progress.

- **id:** `data-timeline`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Show a schedule of tasks with durations and dependencies

### Don't use when

- Point-in-time events: use timeline or data-calendar

### Accessibility

- A labelled grid of rows; every bar is a button with its dates and progress
- Rescheduling has a keyboard path; dependencies are listed as text

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `tasks` | array | yes | — | — | — |
| `dependencies` | array | no | — | — | — |
| `zoom` | enum(day | week | month | quarter) | no | — | `"week"` | — |
| `locale` | string | no | — | `"en"` | — |

### Examples

#### Launch plan (`launch`)

```json
{
  "label": "Launch",
  "zoom": "week",
  "tasks": [
    {
      "id": "d",
      "title": "Design",
      "start": "2026-11-02",
      "end": "2026-11-13",
      "progress": 0.5
    },
    {
      "id": "b",
      "title": "Build",
      "start": "2026-11-16",
      "end": "2026-12-04"
    }
  ],
  "dependencies": [
    {
      "from": "d",
      "to": "b",
      "type": "FS"
    }
  ]
}
```

### Related

- [`data-calendar`](data-calendar.md)
- [`timeline`](timeline.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
