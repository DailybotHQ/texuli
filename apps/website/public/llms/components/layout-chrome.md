# LayoutChrome

> Shared brand, actions, user and skip-link chrome for desktop layouts.

- **id:** `layout-chrome`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Layout frames that share brand and user chrome

### Don't use when

- Standalone navigation without a layout host

### Accessibility

- Skip link targets the main region
- Every href passes the URL policy

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `part` | enum(skip | brand | actions | user) | yes | — | — | — |
| `nav` | object | no | — | — | NavModel for chrome links |
| `mainId` | string | no | — | — | Main region id for the skip link |
| `compact` | boolean | no | — | `false` | — |
| `hrefTrust` | enum(developer | untrusted) | no | developer | `"developer"` | — |
| `skipLabel` | string | no | — | `"Skip to content"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Brand chrome (`brand`)

```json
{
  "part": "brand"
}
```

### Related

- [`layout-host`](layout-host.md)
- [`nav-icon`](nav-icon.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
