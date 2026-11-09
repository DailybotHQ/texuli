# List

> A list of ListItem rows; divided draws a token hairline between them.

- **id:** `list`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `display`

### Use when

- A stack of settings, inbox or navigation rows

### Don't use when

- A data table (use table)
- Prose lists (use prose)

### Accessibility

- A ul of listitems. Dividers are decorative.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `divided` | boolean | no | — | `false` | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | ListItem rows |

### Examples

#### Divided inbox (`inbox`)

```json
{
  "divided": true
}
```

### Related

- [`list-item`](list-item.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
