# Empty state

> Placeholder when a list or panel has nothing to show yet.

- **id:** `empty-state`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- First-run or filtered-empty lists

### Don't use when

- A failure after a request (use error-state)

### Accessibility

- Title is required text; illustration is decorative (aria-hidden).

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | — | — |
| `description` | string | no | — | — | — |
| `illustration` | slot | no | — | — | — |
| `action` | slot | no | — | — | — |
| `size` | enum(sm | md) | no | — | `"md"` | — |
| `class` | string | no | — | — | — |

### Examples

#### No orders (`no-orders`)

```json
{
  "title": "No orders yet",
  "description": "Create an order to get started.",
  "size": "md"
}
```

### Related

- [`error-state`](error-state.md)
- [`table`](table.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
