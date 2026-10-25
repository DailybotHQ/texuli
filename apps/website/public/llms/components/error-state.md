# Error state

> Full-panel failure with optional retry.

- **id:** `error-state`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- A view failed to load and the user can retry

### Don't use when

- A soft warning inline (use alert)

### Accessibility

- Uses role=alert; retry is a real button with pending support.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | — | `"Something went wrong"` | — |
| `message` | string | no | — | — | — |
| `onRetry` | event | no | — | — | — |
| `retryLabel` | string | no | — | `"Try again"` | — |
| `action` | slot | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Retry error (`retry`)

```json
{
  "title": "Could not load orders",
  "message": "Check your connection.",
  "retryLabel": "Retry"
}
```

### Related

- [`empty-state`](empty-state.md)
- [`alert`](alert.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
