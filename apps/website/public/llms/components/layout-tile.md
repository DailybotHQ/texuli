# Grid tile

> A titled tile inside layout-grid that can span several columns or rows.

- **id:** `layout-tile`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `composition`

### Use when

- Make one dashboard tile wider or taller than its neighbors

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- DOM order stays reading order; the layout never reorders children visually
- Logical properties only, so right-to-left content mirrors

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | untrusted | — | — |
| `span` | number | no | — | `1` | Columns, 1 to 4. |
| `rowSpan` | number | no | — | `1` | Rows, 1 or 2. |
| `children` | slot | no | — | — | — |

### Examples

#### Wide tile (`wide`)

```json
{
  "title": "Trend",
  "span": 2
}
```

### Related

- [`layout-grid`](layout-grid.md)
- [`layout-card`](layout-card.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
