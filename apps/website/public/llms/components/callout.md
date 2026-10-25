# Callout

> Emphasized documentation-style tip with a strong start edge.

- **id:** `callout`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Highlight a tip or note beside prose

### Don't use when

- A blocking error (use alert with error tone)
- A site-wide notice (use banner)

### Accessibility

- Same tone roles as Alert; never color-only meaning.

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

#### Info callout (`info-tip`)

```json
{
  "tone": "info",
  "title": "Tip",
  "text": "Export works offline in this prototype."
}
```

### Related

- [`alert`](alert.md)
- [`banner`](banner.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
