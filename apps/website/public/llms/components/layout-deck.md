# Deck layout

> Slide deck frame for sequenced content.

- **id:** `layout-deck`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `layouts`

### Use when

- Compose deck layout structure in agent-authored trees

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- Structure is semantic regions the host maps to real layout components
- No HTML strings; children are nested catalog nodes

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `title` | string | no | untrusted | — | — |
| `description` | string | no | untrusted | — | — |
| `locale` | string | no | — | — | Language tag such as en or en-GB |
| `aspect` | enum(16:9 | 4:3 | 9:16 | 1:1) | no | — | `"16:9"` | — |
| `themeRef` | unknown | no | — | — | Catalog theme id, or a catalog or embedded theme reference object |
| `masters` | array | no | — | — | Built-in slide master ids the slides may use |
| `settings` | object | no | — | — | startIndex, loop, showProgress and defaultTransition |
| `slides` | array | no | — | — | Structured slide objects (@texuli/deck model v2 grammar); prefer deck-slide children |
| `transition` | enum(none | fade | fade-up | slide | zoom | morph) | no | — | — | Default slide transition (model v2) |
| `motion` | enum(full | subtle | none) | no | — | — | Motion ceiling for the deck |
| `navigation` | object | no | — | — | loop, start slide id, autoSlideMs |
| `outline` | object | no | — | — | Sections and vertical stacks (model v2 outline) |
| `children` | slot | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Deck layout (`basic`)

```json
{
  "title": "Pitch",
  "aspect": "16:9"
}
```

### Related

- [`layout-page`](layout-page.md)
- [`layout-doc`](layout-doc.md)
- [`layout-grid`](layout-grid.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
