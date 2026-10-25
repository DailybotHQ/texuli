# Breadcrumb

> Hierarchy trail with URL-policy links.

- **id:** `breadcrumb`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Show location in a hierarchy

### Don't use when

- Primary navigation (use navigation-menu or sidebar)

### Accessibility

- nav landmark; current page is not a link.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | yes | — | — | BreadcrumbItem[] |
| `label` | string | no | — | `"Breadcrumb"` | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `separatorLabel` | string | no | — | `"Separator"` | — |
| `separator` | slot | no | — | — | — |
| `maxItems` | number | no | — | `0` | — |
| `hrefTrust` | enum(developer | untrusted) | no | developer | `"developer"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Trail (`trail`)

```json
{
  "items": [
    {
      "label": "Workspace",
      "href": "https://example.com"
    },
    {
      "label": "Notes",
      "href": "https://example.com/notes"
    },
    {
      "label": "Harbor"
    }
  ]
}
```

### Related

- [`navigation-menu`](navigation-menu.md)
- [`pagination`](pagination.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
