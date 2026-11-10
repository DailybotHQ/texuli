# Input

> A single-line text (or file) control with optional clear.

- **id:** `input`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Short free-text fields
- Native file selection

### Don't use when

- Multi-line text (use textarea)
- A labeled field with description and error (wrap in field)

### Accessibility

- Pair with Field or an external label via id/for
- Clear control has an accessible name when clearable

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `type` | string | no | — | `"text"` | Native input type |
| `value` | string | no | — | — | Controlled value (bind:value) |
| `files` | unknown | no | — | — | FileList when type=file (bind:files) |
| `ref` | unknown | no | — | — | Element ref for the native input |
| `clearable` | boolean | no | — | `false` | — |
| `clearLabel` | string | no | — | `"Clear"` | — |
| `disabled` | boolean | no | — | `false` | — |
| `readonly` | boolean | no | — | `false` | — |
| `onValueChange` | event | no | — | — | — |
| `onClear` | event | no | — | — | — |
| `appearance` | enum(default | plain) | no | — | `"default"` | plain drops the control chrome for inline-edit text; focus stays visible |
| `textSize` | enum(control | xs | sm | md | lg | xl | 2xl | 3xl | 4xl | display) | no | — | `"control"` | control (form-control size) or a type-scale size for inline-edit titles and bodies |
| `class` | string | no | — | — | — |

### Examples

#### Text input (`text`)

```json
{
  "type": "text",
  "clearable": true
}
```

#### Email input (`email`)

```json
{
  "type": "email"
}
```

#### Inline-edit title (`inline-title`)

```json
{
  "appearance": "plain",
  "textSize": "xl"
}
```

### Related

- [`input-group`](input-group.md)
- [`textarea`](textarea.md)
- [`field`](field.md)
- [`text-counter`](text-counter.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
