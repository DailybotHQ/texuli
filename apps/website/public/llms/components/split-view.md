# SplitView

> Master-detail split with list and detail panes.

- **id:** `split-view`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- List/detail workflows on wide screens

### Don't use when

- Single-stream feeds

### Accessibility

- List and detail regions are labelled
- Narrow containers show one pane at a time

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `list` | slot | yes | — | — | — |
| `detail` | slot | no | — | — | — |
| `empty` | slot | no | — | — | — |
| `listLabel` | string | no | — | `"List"` | — |
| `detailLabel` | string | no | — | `"Details"` | — |
| `detailActive` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |

### Examples

#### Split (`basic`)

```json
{
  "listLabel": "Inbox"
}
```

### Related

- [`layout-dual-sidebar`](layout-dual-sidebar.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
