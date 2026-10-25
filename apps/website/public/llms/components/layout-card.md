# Card layout

> Content card frame for grouped agent-authored blocks.

- **id:** `layout-card`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `layouts`

### Use when

- Compose card layout structure in agent-authored trees

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- Structure is semantic regions the host maps to real layout components
- No HTML strings; children are nested catalog nodes

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | untrusted | — | — |
| `children` | slot | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Card layout (`basic`)

```json
{
  "title": "Summary"
}
```

### Related

- [`layout-page`](layout-page.md)
- [`layout-doc`](layout-doc.md)
- [`layout-grid`](layout-grid.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
