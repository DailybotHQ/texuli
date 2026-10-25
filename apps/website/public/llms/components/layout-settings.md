# Settings layout

> Settings section list plus detail pane.

- **id:** `layout-settings`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Account and workspace settings

### Don't use when

- Primary app navigation

### Accessibility

- Section list is labelled
- Phone back control is named

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | — | `"Settings"` | — |
| `description` | string | no | — | — | — |
| `sections` | array | yes | — | — | — |
| `active` | string | no | — | — | — |
| `onSelect` | event | no | — | — | — |
| `startWithList` | boolean | no | — | — | — |
| `children` | slot | no | — | — | — |
| `mountScreen` | event | no | — | — | — |
| `navLabel` | string | no | — | — | — |
| `backLabel` | string | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Account settings (`account`)

```json
{
  "sections": [
    {
      "id": "profile",
      "label": "Profile"
    }
  ],
  "active": "profile"
}
```

### Related

- [`layout-wizard`](layout-wizard.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
