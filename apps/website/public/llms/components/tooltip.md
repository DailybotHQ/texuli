# Tooltip

> Short delayed hint on hover or focus.

- **id:** `tooltip`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Icon-only controls need a name
- Optional keyboard shortcut hints

### Don't use when

- Essential instructions (put them in visible copy)

### Accessibility

- Shows on focus; content is plain text or a snippet, never a sink.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `content` | string | yes | — | — | Hint text or rich snippet |
| `children` | slot | yes | — | — | Trigger snippet { props } |
| `shortcut` | string | no | — | — | Shortcut string or list shown as Kbd |
| `side` | enum(top | right | bottom | left) | no | — | `"top"` | — |
| `align` | enum(start | center | end) | no | — | `"center"` | — |
| `sideOffset` | number | no | — | `6` | — |
| `delayDuration` | number | no | — | `300` | — |
| `disabled` | boolean | no | — | `false` | — |
| `open` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |

### Examples

#### Basic tooltip (`basic`)

```json
{
  "content": "Save note",
  "side": "top"
}
```

### Related

- [`popover`](popover.md)
- [`hover-card`](hover-card.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
