# Sidebar

> Collapsible app rail with sections, badges and safe links.

- **id:** `sidebar`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Primary app navigation rail

### Don't use when

- Marketing site nav (use navigation-menu)

### Accessibility

- nav landmark; collapsed items keep accessible names via tooltips.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | no | — | — | — |
| `sections` | array | no | — | — | — |
| `collapsed` | boolean | no | — | `false` | — |
| `collapsible` | boolean | no | — | `true` | — |
| `drawer` | boolean | no | — | `false` | — |
| `variant` | enum(default | inset) | no | — | `"default"` | — |
| `header` | slot | no | — | — | — |
| `footer` | slot | no | — | — | — |
| `itemIcon` | slot | no | — | — | — |
| `label` | string | no | — | `"Main"` | — |
| `collapseLabel` | string | no | — | — | — |
| `expandLabel` | string | no | — | — | — |
| `hrefTrust` | enum(developer | untrusted) | no | developer | `"developer"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Workspace rail (`workspace`)

```json
{
  "label": "Main",
  "sections": [
    {
      "label": "Workspace",
      "items": [
        {
          "label": "Inbox",
          "href": "https://example.com/inbox",
          "active": true
        }
      ]
    }
  ]
}
```

### Related

- [`app-nav`](app-nav.md)
- [`navigation-menu`](navigation-menu.md)
- [`sheet`](sheet.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
