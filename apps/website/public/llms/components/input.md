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

### Related

- [`input-group`](input-group.md)
- [`textarea`](textarea.md)
- [`field`](field.md)
- [`text-counter`](text-counter.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
