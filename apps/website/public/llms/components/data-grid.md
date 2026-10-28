# Data grid

> A sortable, searchable grid of rows and typed columns; virtualized for long lists.

- **id:** `data-grid`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Show many records people sort, search and select

### Don't use when

- A small static table in a document: use table or blocks-data

### Accessibility

- A WAI-ARIA grid with a caption, sortable column headers and roving cell focus
- Sort and search changes are announced; selection is exposed per row

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `caption` | string | yes | untrusted | — | The grid caption and accessible name. |
| `columns` | array | yes | — | — | — |
| `rows` | array | yes | — | — | Rows: an id and one display string per column id (the column kind sorts it). |
| `searchable` | boolean | no | — | `false` | — |
| `selectable` | boolean | no | — | `false` | — |
| `density` | enum(compact | default | comfortable) | no | — | — | — |

### Examples

#### Orders (`orders`)

```json
{
  "caption": "Open orders",
  "columns": [
    {
      "id": "customer",
      "header": "Customer"
    },
    {
      "id": "total",
      "header": "Total",
      "kind": "number",
      "align": "end",
      "sortable": true
    }
  ],
  "rows": [
    {
      "id": "o1",
      "cells": {
        "customer": "Northwind Example",
        "total": "1240"
      }
    },
    {
      "id": "o2",
      "cells": {
        "customer": "Contoso Example",
        "total": "310"
      }
    }
  ]
}
```

### Related

- [`table`](table.md)
- [`blocks-data`](blocks-data.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
