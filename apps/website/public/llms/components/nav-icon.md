# NavIcon

> Renders a nav model icon by name or component.

- **id:** `nav-icon`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Layout chrome needs a consistent nav icon

### Don't use when

- Arbitrary illustration outside nav

### Accessibility

- Decorative by default; pass label when the icon is the only name.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `icon` | string | yes | — | — | Icon name (hosts may also pass a component in code) |
| `class` | string | no | — | — | — |
| `label` | string | no | — | — | — |

### Examples

#### Home icon (`home`)

```json
{
  "icon": "home"
}
```

### Related

- [`layout-chrome`](layout-chrome.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
