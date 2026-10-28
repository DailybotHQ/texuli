# Sortable list

> A list whose items are a bound list variable; people reorder it by drag or keyboard, and lists sharing a group exchange items.

- **id:** `sortable-list`
- **package:** `@texuli/player`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `state`

### Use when

- Let people rank, reorder or move items between lists (priorities, backlog columns)
- Drag as data: the order is the list variable, so other nodes read it

### Don't use when

- A read-only list: use blocks-structure
- Cards between board columns with work-in-progress limits: use data-board

### Accessibility

- A labelled list of items, each with a drag handle button; Space or Enter picks up, arrows move, Space or Enter drops, Escape cancels
- Every move has a non-drag path (keyboard) and is announced politely; reduced motion disables the move animation

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | untrusted | — | Accessible name. |
| `reorder` | object | yes | — | — | Drag as data: bind (a $state list), axis, group, accepts, locked, pull and disabled. |
| `itemLabel` | string | no | — | `"label"` | The item field shown as each item’s text. |
| `itemDetail` | string | no | — | — | An item field shown as secondary text. |

### Examples

#### Priorities (`priorities`)

```json
{
  "label": "This week",
  "reorder": {
    "bind": {
      "$state": "priorities"
    },
    "axis": "vertical"
  }
}
```

### Related

- [`data-board`](data-board.md)
- [`blocks-structure`](blocks-structure.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
