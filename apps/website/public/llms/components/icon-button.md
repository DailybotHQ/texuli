# IconButton

> An icon-only button that requires an accessible name.

- **id:** `icon-button`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Toolbar and dense chrome actions that are icon-only

### Don't use when

- Actions with a visible text label (use button)

### Accessibility

- label is required and becomes aria-label on the control.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | yes | — | — | Accessible name |
| `variant` | enum(default | secondary | outline | ghost | destructive | link) | no | — | `"ghost"` | — |
| `href` | string | no | developer | — | — |
| `loading` | boolean | no | — | `false` | — |
| `autoLoading` | boolean | no | — | `true` | — |
| `disabled` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | Icon content |

### Examples

#### Close icon button (`close`)

```json
{
  "label": "Close"
}
```

### Related

- [`button`](button.md)
- [`button-group`](button-group.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
