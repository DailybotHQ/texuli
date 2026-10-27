# Board

> A kanban board: cards in columns (and optional swimlanes), moved by drag, keyboard or a move menu, with work-in-progress limits.

- **id:** `data-board`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Show work items by status and let people move them between columns

### Don't use when

- One ordered list: use sortable-list
- Read-only status counts: use kpi or a chart

### Accessibility

- Columns are labelled lists; each card has a drag handle button and a "Move to…" menu (the non-drag path)
- Moves are announced politely with column and position; locked cards refuse moves with a reason

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `columns` | array | yes | — | — | — |
| `items` | array | yes | — | — | Cards: each names its column (and lane); rank orders cards within a cell. |
| `lanes` | array | no | — | — | — |
| `density` | enum(comfortable | compact) | no | — | — | — |

### Examples

#### Sprint board (`sprint`)

```json
{
  "label": "Sprint 12",
  "columns": [
    {
      "id": "todo",
      "title": "To do"
    },
    {
      "id": "doing",
      "title": "In progress",
      "wipSoft": 2
    },
    {
      "id": "done",
      "title": "Done"
    }
  ],
  "items": [
    {
      "id": "t1",
      "title": "Draft the release notes",
      "column": "todo",
      "rank": "a0"
    },
    {
      "id": "t2",
      "title": "Review the onboarding flow",
      "column": "doing",
      "rank": "a0"
    }
  ]
}
```

### Related

- [`sortable-list`](sortable-list.md)
- [`data-tree-view`](data-tree-view.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
