# Spinner

> An indeterminate wait indicator, labelled or decorative.

- **id:** `spinner`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show that a short action is in progress

### Don't use when

- A known percent (use progress)
- A layout placeholder (use skeleton)

### Accessibility

- With a label it is a live status; without a label it is decorative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | no | — | — | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `tone` | enum(primary | success | warning | destructive | info | neutral) | no | — | `"primary"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Saving (`saving`)

```json
{
  "label": "Saving",
  "size": "sm"
}
```

### Related

- [`progress`](progress.md)
- [`skeleton`](skeleton.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
