# ContentLayout

> Shared docs/blog/editorial reading frame with optional TOC.

- **id:** `content-layout`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `layouts`

### Use when

- Long-form content with a table of contents

### Don't use when

- App chrome shells

### Accessibility

- Main landmark holds the article
- TOC links are in-page anchors

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `kind` | enum(docs | blog | editorial) | yes | — | — | — |
| `mountScreen` | event | yes | — | — | Host callback that mounts the stable routed screen node |
| `nav` | object | no | — | — | NavModel for chrome links |
| `path` | string | no | — | — | Current hash path |
| `options` | object | no | — | — | Flat data-only layout knobs |
| `storageKey` | string | no | — | — | Scope for persisted UI flags |
| `aside` | slot | no | — | — | Optional context panel |
| `class` | string | no | — | — | — |

### Examples

#### Docs (`docs`)

```json
{
  "kind": "docs",
  "options": {
    "title": "Guides"
  }
}
```

### Related

- [`layout-docs`](layout-docs.md)
- [`layout-blog`](layout-blog.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
