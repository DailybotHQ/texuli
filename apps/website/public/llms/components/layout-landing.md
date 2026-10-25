# Landing layout

> Standalone marketing landing composition.

- **id:** `layout-landing`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Static landing pages without LayoutHost

### Don't use when

- Routed app shells

### Accessibility

- Author-provided landmarks; no default product copy.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `brand` | slot | no | — | — | — |
| `navigation` | slot | no | — | — | — |
| `actions` | slot | no | — | — | — |
| `hero` | slot | no | — | — | — |
| `sections` | slot | no | — | — | — |
| `footer` | slot | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Landing (`basic`)

```json
{}
```

### Related

- [`layout-marketing`](layout-marketing.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
