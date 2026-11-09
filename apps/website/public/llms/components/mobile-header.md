# MobileHeader

> A mobile stack header with back, title and actions. Host chrome; agents never emit it.

- **id:** `mobile-header`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- The top of a phone-sized screen that can go back

### Don't use when

- Desktop app chrome (use layout-top-nav or layout-sidebar)

### Accessibility

- The title is a heading by default; Back and Close are named.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | yes | — | — | — |
| `eyebrow` | string | no | — | — | — |
| `subtitle` | string | no | — | — | — |
| `titleAs` | enum(h1 | h2 | p | div) | no | — | `"h1"` | — |
| `backHref` | string | no | developer | — | — |
| `onBack` | event | no | — | — | — |
| `backLabel` | string | no | — | — | — |
| `backTarget` | string | no | — | — | — |
| `hrefTrust` | enum(developer | untrusted) | no | — | `"developer"` | — |
| `closeHref` | string | no | developer | — | — |
| `onClose` | event | no | — | — | — |
| `closeLabel` | string | no | — | — | — |
| `sticky` | boolean | no | — | `true` | — |
| `class` | string | no | — | — | — |

### Examples

#### Inbox header (`inbox`)

```json
{
  "title": "Inbox",
  "backHref": "/home"
}
```

### Related

- [`bottom-nav`](bottom-nav.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
