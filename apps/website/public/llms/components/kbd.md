# Kbd

> Inline keyboard key affordance.

- **id:** `kbd`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- Document a shortcut next to a control

### Don't use when

- Multi-line code (use code with variant block)

### Accessibility

- Rendered as a real kbd element; text is escaped.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `label` | string | no | — | — | Plain-text key name, escaped; replaces children when both are given |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | The key name (an inline-text node in a tree) |

### Examples

#### Save shortcut (`save`)

```json
{}
```

#### Labelled key (`labelled`)

```json
{
  "label": "Ctrl"
}
```

### Related

- [`code`](code.md)
- [`inline-text`](inline-text.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
