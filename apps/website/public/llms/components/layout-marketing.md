# Marketing layout

> Marketing page frame with hero, sections and footer slots.

- **id:** `layout-marketing`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Landing and product marketing pages

### Don't use when

- Authenticated app chrome

### Accessibility

- Hero and content regions can be labelled
- Navigation is a landmark

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `mountScreen` | event | no | — | — | Optional LayoutHost screen mount |
| `nav` | object | no | — | — | NavModel for chrome links |
| `path` | string | no | — | — | Current hash path |
| `options` | object | no | — | — | Flat data-only layout knobs |
| `storageKey` | string | no | — | — | Scope for persisted UI flags |
| `aside` | slot | no | — | — | Optional context panel |
| `brand` | slot | no | — | — | — |
| `navigation` | slot | no | — | — | — |
| `actions` | slot | no | — | — | — |
| `hero` | slot | no | — | — | — |
| `sections` | slot | no | — | — | — |
| `footer` | slot | no | — | — | — |
| `navigationLabel` | string | no | — | — | — |
| `heroLabel` | string | no | — | — | — |
| `contentLabel` | string | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Marketing (`landing`)

```json
{}
```

### Related

- [`layout-landing`](layout-landing.md)
- [`layout-pricing`](layout-pricing.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
