# BottomNav

> A mobile tab bar of destinations. Host chrome; agents never emit it.

- **id:** `bottom-nav`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Primary destinations on a phone-sized app shell

### Don't use when

- In-page tabs (use tabs)
- Desktop sidebar navigation (use layout-sidebar)

### Accessibility

- A labelled nav landmark; the current destination uses aria-current, not color alone.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `items` | array | yes | — | — | Destinations: href, label, optional icon and badge |
| `label` | string | no | — | — | Accessible name of the landmark |
| `fixed` | boolean | no | — | `false` | — |
| `hrefTrust` | enum(developer | untrusted) | no | — | `"developer"` | — |
| `onSelect` | event | no | — | — | A destination was activated |
| `class` | string | no | — | — | — |

### Examples

#### Primary destinations (`primary`)

```json
{
  "items": [
    {
      "id": "home",
      "href": "/home",
      "label": "Home"
    },
    {
      "id": "inbox",
      "href": "/inbox",
      "label": "Inbox"
    }
  ]
}
```

### Related

- [`mobile-header`](mobile-header.md)
- [`tabs`](tabs.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
