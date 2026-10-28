# Filter builder

> Nested and/or groups of conditions (field, operator by field type, value) that people add, edit and remove.

- **id:** `data-filter-builder`
- **package:** `@texuli/data`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `data`

### Use when

- Let people compose a structured filter, such as "status is open and total over 100"

### Don't use when

- One text filter that other nodes read: use control-filter
- A fixed choice between a few views: use control-choice

### Accessibility

- Native selects and inputs, every one labelled; each group is a labelled fieldset
- Adding and removing conditions moves focus to the next control and is announced politely

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name of the view. |
| `fields` | array | yes | — | — | The fields a condition can test; options list the values of an enum field. |
| `value` | object | no | — | — | The starting filter: {type:"group", op:"and"\|"or", children:[{type:"condition", field, operator, value}…]}. It is checked against fields (at most 6 levels and 200 nodes); one that does not fit starts empty. |
| `maxDepth` | number | no | — | `3` | Deepest group level offered (the root is 1), capped at 5. |
| `disabled` | boolean | no | — | `false` | — |

### Examples

#### Open orders (`open-orders`)

```json
{
  "label": "Order filter",
  "fields": [
    {
      "key": "status",
      "header": "Status",
      "type": "enum",
      "options": [
        "open",
        "closed"
      ]
    },
    {
      "key": "total",
      "header": "Total",
      "type": "number"
    }
  ],
  "value": {
    "type": "group",
    "op": "and",
    "children": [
      {
        "type": "condition",
        "field": "status",
        "operator": "eq",
        "value": "open"
      }
    ]
  }
}
```

### Related

- [`data-grid`](data-grid.md)
- [`control-filter`](control-filter.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
