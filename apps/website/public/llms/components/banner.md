# Banner

> Full-width notice across a page or app shell.

- **id:** `banner`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Announce a global condition (maintenance, trial)

### Don't use when

- Inline field errors (use alert near the field)

### Accessibility

- Same tone roles as Alert; dismiss control is optional and named.

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

#### Brand banner (`brand`)

```json
{
  "tone": "brand",
  "title": "New workspace",
  "text": "Invite teammates from Settings.",
  "dismissible": true
}
```

### Related

- [`alert`](alert.md)
- [`callout`](callout.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
