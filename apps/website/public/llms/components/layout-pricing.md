# Pricing layout

> Pricing plans grid with title and footnote.

- **id:** `layout-pricing`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Pricing tables on marketing pages

### Don't use when

- In-app billing settings (use settings layout)

### Accessibility

- Plans are a list of cards; title names the section.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | — | — | — |
| `description` | string | no | — | — | — |
| `plans` | array | no | — | — | Plan cards data |
| `footnote` | string | no | — | — | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Three plans (`plans`)

```json
{
  "title": "Plans",
  "plans": [
    {
      "id": "free",
      "name": "Free"
    }
  ]
}
```

### Related

- [`layout-marketing`](layout-marketing.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
