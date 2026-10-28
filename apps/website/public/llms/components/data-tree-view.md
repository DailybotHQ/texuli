# Tree view

> A hierarchy of items people expand, select and reorder or re-parent by drag or keyboard.

- **id:** `data-tree-view`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Show nested items such as folders, outlines or org charts

### Don't use when

- A flat list: use list or sortable-list
- Files with previews: use data-files

### Accessibility

- A WAI-ARIA tree with roving focus, typeahead and expand/collapse on arrows
- Moves have a keyboard path and are announced; selection uses checkboxes when enabled

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `items` | array | yes | — | — | Flat items; parent names the parent item (none for a root). |
| `checkboxes` | boolean | no | — | `true` | — |
| `density` | enum(comfortable | compact) | no | — | — | — |

### Examples

#### Project outline (`outline`)

```json
{
  "label": "Launch plan",
  "items": [
    {
      "id": "plan",
      "label": "Plan"
    },
    {
      "id": "scope",
      "label": "Scope",
      "parent": "plan"
    },
    {
      "id": "ship",
      "label": "Ship"
    }
  ]
}
```

### Related

- [`data-files`](data-files.md)
- [`data-board`](data-board.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
