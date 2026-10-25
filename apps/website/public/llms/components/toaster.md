# Toaster

> Live region that renders toast notifications from the shared store.

- **id:** `toaster`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Transient success/error feedback after an action

### Don't use when

- Blocking errors that need a decision (use alert-dialog)

### Accessibility

- role=region with polite live updates; dismiss controls are labelled.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | no | — | `"Notifications"` | — |
| `position` | enum(top-start | top-center | top-end | bottom-start | bottom-center | bottom-end) | no | — | `"bottom-end"` | Block edge and logical inline position; narrow screens center the stack |
| `offset` | string | no | — | — | CSS length or px number from the stack edge |
| `store` | unknown | no | — | — | Optional ToastStore inject (tests) |
| `dismissLabel` | string | no | — | `"Dismiss notification"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Toaster region (`region`)

```json
{
  "label": "Notifications"
}
```

### Related

- [`alert-dialog`](alert-dialog.md)
- [`banner`](banner.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
