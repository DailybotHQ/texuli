# Top navigation layout

> Horizontal top navigation with optional mobile menu.

- **id:** `layout-top-nav`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Product shells with a top bar

### Don't use when

- Dense multi-section sidebars

### Accessibility

- Skip link targets main when chrome is present
- Primary navigation is a labelled landmark

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `mountScreen` | event | yes | — | — | Host callback that mounts the stable routed screen node |
| `nav` | object | no | — | — | NavModel for chrome links |
| `path` | string | no | — | — | Current hash path |
| `options` | object | no | — | — | Flat data-only layout knobs |
| `storageKey` | string | no | — | — | Scope for persisted UI flags |
| `aside` | slot | no | — | — | Optional context panel |
| `class` | string | no | — | — | — |
| `skipLabel` | string | no | — | — | — |
| `menuLabel` | string | no | — | — | — |
| `closeLabel` | string | no | — | — | — |

### Examples

#### Top navigation layout (`default`)

```json
{}
```

### Related

- [`layout-host`](layout-host.md)
- [`layout-chrome`](layout-chrome.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
