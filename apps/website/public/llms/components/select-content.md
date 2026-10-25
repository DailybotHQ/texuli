# Select.Content

> The positioned listbox surface for Select items.

- **id:** `select-content`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Wrap Select items and groups

### Don't use when

- A free-floating popover (use popover)

### Accessibility

- role=listbox; focus stays in the trigger while the list is open.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Medium content (`md`)

```json
{
  "size": "md"
}
```

### Related

- [`select`](select.md)
- [`select-item`](select-item.md)
- [`select-viewport`](select-viewport.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
