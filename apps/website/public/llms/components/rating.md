# Rating

> A star rating the person sets, or a read-only average.

- **id:** `rating`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- A score out of five (or up to ten) stars

### Don't use when

- A binary like/unlike (use a toggle)

### Accessibility

- A labelled radio group; arrows move and select. Display mode is a named image.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | number | no | — | `0` | — |
| `max` | number | no | — | `5` | — |
| `allowHalf` | boolean | no | — | `false` | — |
| `display` | boolean | no | — | `false` | — |
| `clearable` | boolean | no | — | `false` | — |
| `readonly` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `name` | string | no | — | — | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `tone` | enum(warning | primary | neutral) | no | — | `"warning"` | — |
| `showValue` | boolean | no | — | `false` | — |
| `labels` | object | no | — | — | — |
| `onValueChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |

### Examples

#### Review (`review`)

```json
{
  "value": 4,
  "max": 5,
  "name": "rating"
}
```

### Related

- [`field`](field.md)
- [`radio-group`](radio-group.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
