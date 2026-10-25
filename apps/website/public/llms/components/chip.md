# Chip

> A toggleable filter chip (pressed state).

- **id:** `chip`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Filter toggles in a toolbar or facet list

### Don't use when

- Navigation (use a link)
- A one-shot action (use button)

### Accessibility

- Uses aria-pressed for selection; must be a real button.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | — |
| `variant` | enum(default | secondary | outline | success | warning | destructive | info | neutral) | no | — | `"outline"` | — |
| `selected` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `type` | enum(button | submit | reset) | no | — | `"button"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Selected chip (`selected`)

```json
{
  "label": "Active",
  "selected": true
}
```

### Related

- [`badge`](badge.md)
- [`tag`](tag.md)
- [`button`](button.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
