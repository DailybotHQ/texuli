# AvatarGroupGrid

> Up to four faces in one avatar circle, +N past four.

- **id:** `avatar-group-grid`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- A group chat shown as one avatar

### Don't use when

- A row of people (use AvatarGroup)

### Accessibility

- One image named by label or the member names.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | yes | — | — | { name, src?, srcset? }[] |
| `size` | enum(xs | sm | md | lg) | no | — | `"md"` | — |
| `label` | string | no | — | — | Accessible name |
| `overflowLabel` | string | no | — | `"+{n}"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Group chat (`chat`)

```json
{
  "items": [
    {
      "name": "Ada"
    },
    {
      "name": "Lin"
    }
  ]
}
```

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
