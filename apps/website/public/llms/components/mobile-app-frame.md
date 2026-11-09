# MobileAppFrame

> A phone-sized app frame: skip link, header, scrolling screen, optional footer and bottom nav. Host chrome; agents never emit it.

- **id:** `mobile-app-frame`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- The host shell of a phone-sized app

### Don't use when

- In-page content (use layout-page)
- Desktop chrome (use layout-sidebar)

### Accessibility

- A skip link to the screen; the screen is a main landmark unless nested.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `skipLabel` | string | no | — | — | — |
| `mainId` | string | no | — | — | — |
| `mainElement` | enum(main | div) | no | — | `"main"` | — |
| `resetScrollOnNavigate` | boolean | no | — | `true` | — |
| `stickyFooterUnstyled` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |

### Examples

#### Phone frame (`phone`)

```json
{
  "mainId": "screen"
}
```

### Related

- [`bottom-nav`](bottom-nav.md)
- [`mobile-header`](mobile-header.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
