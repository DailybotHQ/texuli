# Deck slide

> One slide in a deck: a title, content blocks and speaker notes.

- **id:** `deck-slide`
- **package:** `texuli`
- **tier:** `content`
- **agent emittable:** yes
- **emit:** developer, untrusted
- **group:** `layouts`

### Use when

- Compose deck slide structure in agent-authored trees

### Don't use when

- App chrome shells (sidebar, top-nav, dialogs)

### Accessibility

- Structure is semantic regions the host maps to real layout components
- No HTML strings; children are nested catalog nodes

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `slideId` | string | yes | — | — | Stable slide id (lowercase letters, digits and hyphens) |
| `title` | string | no | untrusted | — | — |
| `notes` | string | no | untrusted | — | Plain-text speaker notes |
| `master` | enum(title | section | content | two-column | media-left | media-right | quote | closing) | no | — | — | — |
| `transition` | enum(none | fade | fade-up) | no | — | — | — |
| `themeRef` | unknown | no | — | — | Overrides the deck theme for this slide |
| `children` | slot | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Deck slide (`basic`)

```json
{
  "slideId": "opening",
  "title": "Opening"
}
```

### Related

- [`layout-page`](layout-page.md)
- [`layout-doc`](layout-doc.md)
- [`layout-grid`](layout-grid.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
