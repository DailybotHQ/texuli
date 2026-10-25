# NavigationMenu

> Site or app navigation with expandable triggers and links.

- **id:** `navigation-menu`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `overlays`

### Use when

- Primary site navigation with flyouts

### Don't use when

- In-page tabs (use tabs)
- App menubar (use menubar)

### Accessibility

- Landmarks and link semantics; triggers expose expanded state.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | — | — | — |
| `orientation` | enum(horizontal | vertical) | no | — | `"horizontal"` | — |
| `dir` | enum(ltr | rtl) | no | — | — | — |
| `delayDuration` | number | no | — | — | — |
| `onValueChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Main nav (`main`)

```json
{
  "orientation": "horizontal"
}
```

### Related

- [`menubar`](menubar.md)
- [`breadcrumb`](breadcrumb.md)
- [`sidebar`](sidebar.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
