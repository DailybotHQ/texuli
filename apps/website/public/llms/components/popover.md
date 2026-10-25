# Popover

> Non-modal floating panel anchored to a trigger.

- **id:** `popover`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Lightweight detail next to a control
- Pickers that are not full dialogs

### Don't use when

- Modal workflows (use dialog)
- Single-line hints (use tooltip)

### Accessibility

- Focus can move into the panel; Escape dismisses.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `onOpenChange` | event | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Open popover (`open`)

```json
{
  "open": true
}
```

### Related

- [`hover-card`](hover-card.md)
- [`tooltip`](tooltip.md)
- [`dialog`](dialog.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
