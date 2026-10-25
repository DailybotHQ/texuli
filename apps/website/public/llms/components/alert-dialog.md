# AlertDialog

> Modal confirm/cancel dialog for consequential actions.

- **id:** `alert-dialog`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Confirm delete or irreversible actions
- Require an explicit choice

### Don't use when

- Informational copy without a choice (use dialog or toast)

### Accessibility

- Role alertdialog; focus trapped until confirm or cancel
- Destructive mode styles the confirm action and warning icon

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `title` | string | yes | — | — | — |
| `description` | string | no | — | — | — |
| `confirmLabel` | string | no | — | `"Confirm"` | — |
| `cancelLabel` | string | no | — | `"Cancel"` | — |
| `destructive` | boolean | no | — | `false` | — |
| `onConfirm` | event | no | — | — | — |
| `onCancel` | event | no | — | — | — |
| `trigger` | slot | no | — | — | — |
| `children` | slot | no | — | — | — |
| `class` | string | no | — | — | — |
| `errorFallback` | string | no | — | — | — |
| `onOpenChange` | event | no | — | — | — |

### Examples

#### Destructive confirm (`delete`)

```json
{
  "title": "Delete note?",
  "description": "This cannot be undone.",
  "destructive": true,
  "confirmLabel": "Delete",
  "open": true
}
```

### Related

- [`dialog`](dialog.md)
- [`toaster`](toaster.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
