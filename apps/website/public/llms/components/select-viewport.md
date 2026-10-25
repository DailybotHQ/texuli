# Select.Viewport

> Scrollable viewport inside Select.Content.

- **id:** `select-viewport`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Long option lists that need an internal scroll region

### Don't use when

- Short lists that fit without scrolling

### Accessibility

- Keeps option focus management inside the listbox.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Viewport (`viewport`)

```json
{}
```

### Related

- [`select-content`](select-content.md)
- [`select-item`](select-item.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
