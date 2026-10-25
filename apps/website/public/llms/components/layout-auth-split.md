# Auth split layout

> Sign-in form column plus brand panel.

- **id:** `layout-auth-split`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Sign-in and account entry pages

### Don't use when

- Post-auth app chrome

### Accessibility

- Form and brand panels are labelled
- Brand copy is author-provided

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `form` | slot | no | — | — | — |
| `mountScreen` | event | no | — | — | — |
| `brand` | slot | no | — | — | — |
| `panel` | slot | no | — | — | — |
| `brandTitle` | string | no | — | — | — |
| `brandDescription` | string | no | — | — | — |
| `brandEyebrow` | string | no | — | — | — |
| `formLabel` | string | no | — | — | — |
| `panelLabel` | string | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Sign in (`sign-in`)

```json
{
  "brandTitle": "Harbor",
  "formLabel": "Sign in"
}
```

### Related

- [`layout-wizard`](layout-wizard.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
