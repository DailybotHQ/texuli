# Select.Portal

> Portals Select.Content out of overflow-clipped ancestors.

- **id:** `select-portal`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Select must escape a scroll or overflow container

### Don't use when

- Inline content that fits in-flow

### Accessibility

- Does not change roles; children keep listbox semantics.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `children` | slot | no | — | — | — |

### Examples

#### Portal (`portal`)

```json
{}
```

### Related

- [`select-content`](select-content.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
