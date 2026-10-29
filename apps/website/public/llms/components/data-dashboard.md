# Dashboard

> A widget grid people can rearrange: data-dashboard-widget children on columns and rows, moved and resized by drag or keyboard, reflowing on narrow screens.

- **id:** `data-dashboard`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- An overview of several views (KPIs, charts, grids bound to host data sources) people arrange themselves
- A home or operations screen whose layout should persist per person

### Don't use when

- A fixed grid of cards: use layout-grid
- One chart or one table: paint it on its own

### Accessibility

- A named region whose widgets are a list in reading order (row, then column), whatever order they were written in
- Each widget has a move handle and a resize handle: Space or Enter picks up, arrows move or resize one column or row, Space or Enter drops, Escape cancels; every step is announced with its column, row and size
- A click on a handle opens an arrange toolbar, so nothing needs a drag (WCAG 2.5.7); handles are at least 24 by 24 px
- Widgets glide to their new cell only when motion is allowed; reduced motion commits at once

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `columns` | number | no | — | `12` | Columns of the widest grid (1 to 24). Narrower screens reflow onto at most 6 columns from 640 px and one column below. |
| `density` | enum(compact | default | comfortable) | no | — | — | — |
| `gap` | enum(none | small | medium | large) | no | — | — | — |
| `editable` | boolean | no | — | `false` | Shows the move and resize handles. |
| `compaction` | enum(vertical | none) | no | — | `"vertical"` | "vertical" floats widgets up to close gaps; "none" keeps gaps. |
| `layout` | array | no | — | — | The saved layout of the widest grid: one {id, x, y, w, h} per widget, id matching a widget's widgetId. Bind it to a list state, or read it from a host data source, to persist what people arrange; without it the widgets' own place props lay out the grid. |
| `children` | slot | no | — | — | data-dashboard-widget nodes only (at most 200). |

### Examples

#### Operations overview (`operations`)

```json
{
  "label": "Operations",
  "columns": 12,
  "editable": true
}
```

### Related

- [`data-dashboard-widget`](data-dashboard-widget.md)
- [`layout-grid`](layout-grid.md)
- [`data-grid`](data-grid.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
