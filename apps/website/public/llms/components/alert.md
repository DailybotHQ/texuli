# Alert

> Inline feedback for a page section (status or error).

- **id:** `alert`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Report a result or problem next to the related content

### Don't use when

- A full-page failure (use error-state)
- A quiet tip in docs (use callout)

### Accessibility

- error tone uses role=alert; other tones use role=status; dismiss is named.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `tone` | enum(info | success | warning | error | brand | neutral) | no | — | `"info"` | — |
| `title` | string | no | — | — | Optional heading |
| `text` | string | no | untrusted | — | Body copy |
| `hideIcon` | boolean | no | — | `false` | — |
| `icon` | slot | no | — | — | Custom icon snippet |
| `actionLabel` | string | no | — | — | — |
| `actionHref` | string | no | developer | — | Optional action link (URL policy) |
| `onAction` | event | no | — | — | — |
| `dismissible` | boolean | no | — | `false` | — |
| `dismissLabel` | string | no | — | `"Dismiss"` | — |
| `onDismiss` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Warning alert (`warning`)

```json
{
  "tone": "warning",
  "title": "Check inventory",
  "text": "Three SKUs are low."
}
```

### Related

- [`callout`](callout.md)
- [`banner`](banner.md)
- [`error-state`](error-state.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
