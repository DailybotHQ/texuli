# Editorial layout

> Long-read editorial layout (content-layout kind editorial).

- **id:** `layout-editorial`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Magazine-style long reads

### Don't use when

- Dense data grids

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

### Examples

#### Editorial layout (`default`)

```json
{
  "options": {
    "title": "The long read"
  }
}
```

### Related

- [`layout-host`](layout-host.md)
- [`layout-chrome`](layout-chrome.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
