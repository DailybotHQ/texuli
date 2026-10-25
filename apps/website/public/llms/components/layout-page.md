# Page layout

> Full page content frame for agent-authored documents.

- **id:** `layout-page`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `layouts`

### Use when

- Compose page layout structure in agent-authored trees

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- Structure is semantic regions the host maps to real layout components
- No HTML strings; children are nested catalog nodes

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | untrusted | — | — |
| `description` | string | no | untrusted | — | — |
| `children` | slot | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Page layout (`basic`)

```json
{
  "title": "Overview",
  "description": "Quarterly update"
}
```

### Related

- [`layout-doc`](layout-doc.md)
- [`layout-grid`](layout-grid.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
