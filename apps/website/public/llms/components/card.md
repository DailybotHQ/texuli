# Card

> A surface for grouping related content with optional link behavior.

- **id:** `card`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Group related content in a bordered surface
- Make a whole tile a single link

### Don't use when

- A single line of chrome (use badge or button)
- A data grid of many rows (use table)

### Accessibility

- When href is set, the card is a real link with an accessible name
- Rejected href schemes render as a non-interactive surface

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `variant` | enum(elevated | flat) | no | — | `"elevated"` | Visual elevation |
| `href` | string | no | developer | — | Optional link target (URL policy) |
| `hrefTrust` | enum(developer | untrusted) | no | — | `"developer"` | — |
| `linkLabel` | string | no | — | — | Accessible name when the card is a link |
| `class` | string | no | — | — | Extra classes |

### Examples

#### Elevated card (`elevated`)

```json
{
  "variant": "elevated"
}
```

#### Linked card (`linked`)

```json
{
  "variant": "flat",
  "href": "https://example.com/docs",
  "linkLabel": "Open documentation"
}
```

### Related

- [`button`](button.md)
- [`stat`](stat.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
