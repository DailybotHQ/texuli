# ListItem

> A list row with a title, optional description, icon and trailing meta.

- **id:** `list-item`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- A settings row, an inbox row, or a navigation list of links

### Don't use when

- A data table (use table)
- A kanban card (use data-board)

### Accessibility

- A listitem; with href it is a link, with onSelect a button. Trailing controls sit outside the main control.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | untrusted | — | — |
| `description` | string | no | untrusted | — | — |
| `meta` | string | no | untrusted | — | — |
| `icon` | string | no | — | — | Built-in or registered icon name |
| `href` | string | no | untrusted | — | — |
| `hrefTrust` | enum(developer | untrusted) | no | — | `"developer"` | — |
| `current` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |

### Examples

#### Inbox row (`inbox`)

```json
{
  "title": "Quarterly notes",
  "description": "Ada Example",
  "meta": "2h",
  "icon": "info"
}
```

### Related

- [`icon`](icon.md)
- [`avatar`](avatar.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
