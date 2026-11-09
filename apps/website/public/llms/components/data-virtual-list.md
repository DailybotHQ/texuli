# Virtual list view

> A windowed list of any length: only the visible rows are in the page, measured as they render, and each is announced with its position.

- **id:** `data-virtual-list`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** no
- **emit:** 
- **group:** `data`

### Use when

- Show a long feed, log or result list (hundreds to tens of thousands of rows)
- Let people pick one row from a long list by keyboard

### Don't use when

- Rows with columns: use data-grid
- A short list: use list
- Rows with their own buttons or links: a listbox option holds no controls

### Accessibility

- A WAI-ARIA listbox with one tab stop; aria-activedescendant names the active row
- Every row carries aria-setsize and aria-posinset, so its position in the full list is announced
- Arrow keys, Home, End, Page Up and Page Down move; Enter, Space or a click selects

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `items` | array | yes | — | — | The rows; a row snippet in host code may render any item shape. |
| `size` | enum(sm | md | lg | fill) | no | — | `"md"` | Viewport height: sm, md or lg, or fill to take the parent height. |
| `density` | enum(compact | default | comfortable) | no | — | `"default"` | — |
| `estimateSize` | number | no | — | `40` | Row height in px used until a row has been measured. |
| `overscan` | number | no | — | `3` | Rows rendered before and after the viewport (at most 50). |
| `selected` | string | no | — | — | The selected row id. |
| `emptyLabel` | string | no | untrusted | `"No items"` | — |

### Examples

#### Team feed (`feed`)

```json
{
  "label": "Team feed",
  "items": [
    {
      "id": "u1",
      "label": "Release notes drafted",
      "description": "Docs team, example.com"
    },
    {
      "id": "u2",
      "label": "Onboarding flow reviewed"
    },
    {
      "id": "u3",
      "label": "Quarterly plan shared",
      "description": "Planning, example.com"
    }
  ]
}
```

### Related

- [`data-grid`](data-grid.md)
- [`data-notification-inbox`](data-notification-inbox.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
