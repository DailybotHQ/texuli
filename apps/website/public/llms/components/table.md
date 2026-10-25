# Table

> A responsive data table with density, stacking and sticky header options.

- **id:** `table`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Tabular comparison of many rows and columns

### Don't use when

- A single metric (use stat or kpi)
- A free-form card layout

### Accessibility

- Real table markup with caption or label for the scroll region
- Stacked mode keeps labels associated with cells
- busy sets aria-busy on the table

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `variant` | enum(plain | striped | grid) | no | — | `"plain"` | — |
| `density` | enum(compact | default | comfortable) | no | — | `"default"` | — |
| `stack` | enum(never | sm | md) | no | — | `"never"` | Stack rows into labelled cards when the container is narrow |
| `stickyHeader` | boolean | no | — | `false` | — |
| `maxBlockSize` | string | no | — | — | CSS length capping height so the body scrolls |
| `label` | string | no | — | — | Accessible name for the scroll area |
| `busy` | boolean | no | — | `false` | — |
| `wrapperClass` | string | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Striped sticky header (`striped-sticky`)

```json
{
  "variant": "striped",
  "stickyHeader": true,
  "stack": "sm",
  "label": "Orders"
}
```

### Related

- [`stat`](stat.md)
- [`empty-state`](empty-state.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
