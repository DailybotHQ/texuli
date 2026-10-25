# Select.Trigger

> The button that opens a Select listbox.

- **id:** `select-trigger`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Compose a Select with custom trigger content

### Don't use when

- A standalone button outside Select

### Accessibility

- aria-haspopup=listbox and aria-expanded reflect open state.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `variant` | enum(outline | soft) | no | — | `"outline"` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Default trigger (`default`)

```json
{
  "size": "md",
  "variant": "outline"
}
```

### Related

- [`select`](select.md)
- [`select-value`](select-value.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
