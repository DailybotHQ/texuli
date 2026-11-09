# Textarea

> A multi-line text control with optional autosize.

- **id:** `textarea`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Longer free-text fields (notes, comments, descriptions)

### Don't use when

- A single-line value (use input)

### Accessibility

- Pair with Field or an external label; autosize disables manual resize.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | string | no | — | — | — |
| `ref` | unknown | no | — | — | — |
| `autosize` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `readonly` | boolean | no | — | `false` | — |
| `rows` | number | no | — | `3` | — |
| `onValueChange` | event | no | — | — | — |
| `appearance` | enum(default | plain) | no | — | `"default"` | plain drops the control chrome for inline-edit text; focus stays visible |
| `textSize` | enum(control | xs | sm | md | lg | xl | 2xl | 3xl | 4xl | display) | no | — | `"control"` | control (form-control size) or a type-scale size for inline-edit titles and bodies |
| `class` | string | no | — | — | — |

### Examples

#### Autosize textarea (`autosize`)

```json
{
  "autosize": true,
  "rows": 3
}
```

### Related

- [`input`](input.md)
- [`text-counter`](text-counter.md)
- [`field`](field.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
