# Dashboard widget

> One titled widget of a data-dashboard, placed on the grid; its child is any content node, such as a chart, a KPI or a grid bound to a host data source.

- **id:** `data-dashboard-widget`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- A tile of a data-dashboard

### Don't use when

- Anywhere outside a data-dashboard: use layout-card

### Accessibility

- Its title is a heading, and it names the widget's move and resize handles
- Its content is ordinary catalog nodes: no HTML, and data only from host-registered sources

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `widgetId` | string | yes | — | — | Stable id, unique in the dashboard: letters, digits, "-" and "_", at most 64 characters. The key of this widget in every saved layout. |
| `title` | string | yes | untrusted | — | Visible title; also names the handles. |
| `place` | object | no | — | — | Where the widget starts on the widest grid when the dashboard has no saved layout for it: {x, y, w, h} in columns and rows, with optional minW, minH, maxW, maxH and locked. Without x and y it takes the first free slot. |
| `children` | slot | no | — | — | The widget content. |

### Examples

#### Revenue tile (`revenue`)

```json
{
  "widgetId": "revenue",
  "title": "Revenue",
  "place": {
    "x": 0,
    "y": 0,
    "w": 4,
    "h": 2
  }
}
```

### Related

- [`data-dashboard`](data-dashboard.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
