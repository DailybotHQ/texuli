# Skeleton

> A placeholder bar or circle while content loads.

- **id:** `skeleton`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Reserve space for text or an avatar that has not arrived yet

### Don't use when

- A determinate load (use progress)
- A live status (use spinner)

### Accessibility

- Decorative (aria-hidden); pair it with a live status elsewhere if the wait matters.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `circle` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |

### Examples

#### Text line (`line`)

```json
{
  "size": "md"
}
```

#### Avatar placeholder (`face`)

```json
{
  "size": "md",
  "circle": true
}
```

### Related

- [`spinner`](spinner.md)
- [`progress`](progress.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
