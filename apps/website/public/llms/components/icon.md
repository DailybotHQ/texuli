# Icon

> A glyph by name or Lucide component; allowing icon allows every icon set.

- **id:** `icon`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- A decorative or labelled glyph next to a control or a list row

### Don't use when

- A pressable control (use icon-button)
- Navigation chrome (use nav-icon)

### Accessibility

- With a label it is an image; without a label it is decorative (aria-hidden).
- Unknown names render nothing.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `icon` | string | no | — | — | Built-in name, registered name, or a Lucide component |
| `size` | enum(xs | sm | md | lg) | no | — | `"md"` | — |
| `tone` | enum(default | primary | success | warning | destructive | info | neutral) | no | — | `"default"` | — |
| `label` | string | no | — | — | Accessible name; omit for decorative |
| `class` | string | no | — | — | — |

### Examples

#### Search glyph (`search`)

```json
{
  "icon": "search",
  "label": "Search"
}
```

#### Muted chevron (`muted`)

```json
{
  "icon": "chevron-down",
  "tone": "neutral"
}
```

### Related

- [`icon-button`](icon-button.md)
- [`nav-icon`](nav-icon.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
