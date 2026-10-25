# LayoutHost

> Resolves a layout id, applies width fallbacks, and keeps one stable screen outlet.

- **id:** `layout-host`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Apps that switch between shared layouts without remounting the screen

### Don't use when

- A single fixed page frame with no layout catalog

### Accessibility

- Loading state is named for assistive tech
- Screen outlet stays stable across layout switches

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `layout` | enum(sidebar | rail | top-nav | dual-sidebar | master-detail | dashboard-grid | docs | blog | editorial | marketing | mobile-tabs | mobile-drawer | wizard | auth-split | custom) | yes | — | — | Layout catalog id |
| `children` | slot | yes | — | — | Screen content |
| `nav` | object | no | — | — | NavModel for chrome links |
| `path` | string | no | — | — | Current hash path |
| `options` | object | no | — | — | Flat data-only layout knobs |
| `storageKey` | string | no | — | — | Scope for persisted UI flags |
| `aside` | slot | no | — | — | Optional context panel |
| `dir` | enum(ltr | rtl) | no | — | — | Document direction |
| `loadingLabel` | string | no | — | `"Loading layout"` | — |
| `class` | string | no | — | — | — |

### Examples

#### Sidebar host (`sidebar`)

```json
{
  "layout": "sidebar"
}
```

### Related

- [`layout-sidebar`](layout-sidebar.md)
- [`layout-chrome`](layout-chrome.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
