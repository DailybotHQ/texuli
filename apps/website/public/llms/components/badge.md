# Badge

> A compact status or category label.

- **id:** `badge`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Show a short status or category next to a title

### Don't use when

- A removable filter (use tag)
- A toggleable filter chip (use chip)

### Accessibility

- Never convey meaning by color alone; pair with a word.
- In a catalog tree, set label (or put the word in an inline-text child).

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `variant` | enum(default | secondary | outline | success | warning | destructive | info | neutral) | no | — | `"default"` | — |
| `label` | string | no | — | — | Plain-text badge word, escaped; replaces children when both are given |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | The badge word (an inline-text node in a tree) |

### Examples

#### Success badge (`success`)

```json
{
  "variant": "success"
}
```

#### Labelled badge (`labelled`)

```json
{
  "variant": "info",
  "label": "Shipped"
}
```

### Related

- [`tag`](tag.md)
- [`chip`](chip.md)
- [`inline-text`](inline-text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
