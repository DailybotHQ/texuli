# Select.Group

> Groups related Select items under an optional label.

- **id:** `select-group`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Cluster related options inside a long Select

### Don't use when

- A single flat list of options

### Accessibility

- role=group; pair with Select.Label for an accessible name.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Group (`group`)

```json
{}
```

### Related

- [`select-label`](select-label.md)
- [`select-item`](select-item.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
