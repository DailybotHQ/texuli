# Dialog

> Modal dialog with title, optional description, body and footer.

- **id:** `dialog`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Confirm multi-step flows
- Show focused detail without leaving the page

### Don't use when

- A destructive confirm that must trap attention (use alert-dialog)
- Non-modal hints (use popover or tooltip)

### Accessibility

- Focus moves into the dialog and returns on close
- Title is required; Escape dismisses unless prevented

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `title` | string | yes | — | — | Accessible dialog title |
| `description` | string | no | — | — | — |
| `size` | enum(sm | md | lg | xl) | no | — | `"md"` | — |
| `trigger` | slot | no | — | — | Trigger snippet receiving { props } |
| `footer` | slot | no | — | — | — |
| `children` | slot | no | — | — | — |
| `hideClose` | boolean | no | — | `false` | — |
| `closeLabel` | string | no | — | `"Close"` | — |
| `onOpenChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Basic dialog (`basic`)

```json
{
  "title": "Edit note",
  "description": "Harbor Notes settings",
  "open": true
}
```

### Related

- [`alert-dialog`](alert-dialog.md)
- [`sheet`](sheet.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
