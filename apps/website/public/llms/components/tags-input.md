# TagsInput

> A list of tags the person types, pastes or removes.

- **id:** `tags-input`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- A short list of labels or keywords

### Don't use when

- A single choice from a closed list (use select or combobox)

### Accessibility

- A labelled group; the text input is named. Remove buttons are named.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | array | no | — | — | The tags (bind:value) |
| `delimiter` | string | no | — | `","` | — |
| `max` | number | no | — | — | — |
| `disabled` | boolean | no | — | `false` | — |
| `readonly` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `name` | string | no | — | — | — |
| `label` | string | no | — | — | — |
| `placeholder` | string | no | — | — | — |
| `onValueChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Topics (`topics`)

```json
{
  "value": [
    "design",
    "tokens"
  ],
  "label": "Topics"
}
```

### Related

- [`field`](field.md)
- [`combobox`](combobox.md)
- [`multi-select`](multi-select.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
