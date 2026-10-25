# Pagination

> Page controls for long lists.

- **id:** `pagination`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Paging tables or search results

### Don't use when

- Infinite scroll only feeds

### Accessibility

- Named navigation; previous/next buttons disabled at ends.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `page` | number | no | — | `1` | — |
| `pageCount` | number | yes | — | — | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `variant` | enum(outline | soft) | no | — | `"outline"` | — |
| `onPageChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |
| `label` | string | no | — | — | — |

### Examples

#### Twelve pages (`pages`)

```json
{
  "page": 1,
  "pageCount": 12
}
```

### Related

- [`breadcrumb`](breadcrumb.md)
- [`table`](table.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
