# Tag

> A labeled chip that can be removed.

- **id:** `tag`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show a selected filter or category the user can remove

### Don't use when

- Static status (use badge)
- A pressed filter control (use chip)

### Accessibility

- Remove control has an accessible name; pending remove is disabled.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | Visible label |
| `variant` | enum(default | secondary | outline | success | warning | destructive | info | neutral) | no | — | `"secondary"` | — |
| `removeLabel` | string | no | — | `"Remove"` | — |
| `onRemove` | event | no | — | — | Called when remove is activated |
| `disabled` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |

### Examples

#### Removable tag (`removable`)

```json
{
  "label": "Logistics",
  "variant": "info"
}
```

### Related

- [`badge`](badge.md)
- [`chip`](chip.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
