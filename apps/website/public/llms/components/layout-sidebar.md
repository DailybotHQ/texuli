# Sidebar layout

> App sidebar column with responsive drawer fallback.

- **id:** `layout-sidebar`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Desktop apps with persistent primary navigation

### Don't use when

- Marketing landing pages

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

#### Sidebar layout (`default`)

```json
{}
```

### Related

- [`layout-host`](layout-host.md)
- [`layout-chrome`](layout-chrome.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
