# Link

> An inline sentence link. Underline and color come from link tokens; href is filtered by the URL policy.

- **id:** `link`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- A word or phrase inside a sentence that navigates

### Don't use when

- A button-shaped control (use button with href)
- A whole card (use card with href)

### Accessibility

- Renders one real link that wraps in the line
- http(s) destinations, external, and target=_blank add rel=noopener noreferrer
- A refused href renders as text, never a dead link

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `href` | string | yes | developer | — | Destination (URL policy) |
| `hrefTrust` | enum(developer | untrusted) | no | — | `"developer"` | — |
| `external` | boolean | no | — | `false` | Adds rel=noopener noreferrer (also added for http(s) and target=_blank) |
| `target` | string | no | — | — | Link target; _blank always adds noopener noreferrer |
| `rel` | string | no | — | — | Extra rel tokens; noopener/noreferrer are merged when needed |
| `label` | string | no | — | — | Plain-text label, escaped |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | Rich link text; replaced by a non-empty label |

### Examples

#### Inline sentence link (`inline`)

```json
{
  "href": "https://example.com/guide",
  "label": "the harbor guide"
}
```

#### External link (`external`)

```json
{
  "href": "https://example.com/docs",
  "external": true,
  "label": "Docs"
}
```

### Related

- [`button`](button.md)
- [`prose`](prose.md)
- [`text`](text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
