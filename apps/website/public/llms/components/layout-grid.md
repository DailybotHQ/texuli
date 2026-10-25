# Grid layout

> Responsive content grid for agent-authored tiles.

- **id:** `layout-grid`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `layouts`

### Use when

- Compose grid layout structure in agent-authored trees

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- Structure is semantic regions the host maps to real layout components
- No HTML strings; children are nested catalog nodes

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `columns` | number | no | — | `2` | — |
| `gap` | string | no | — | `"1rem"` | — |
| `children` | slot | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Grid layout (`basic`)

```json
{
  "columns": 2,
  "gap": "1rem"
}
```

### Related

- [`layout-page`](layout-page.md)
- [`layout-doc`](layout-doc.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
