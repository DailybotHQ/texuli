# ToggleGroup

> A group of toggle buttons: one value, or several.

- **id:** `toggle-group`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- A small closed set of filters or views the person toggles

### Don't use when

- A single on/off (use switch or toggle)
- A long list of options (use checkbox)

### Accessibility

- A labelled toolbar of toggle buttons; arrows move, Space presses.

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `type` | enum(single | multiple) | no | — | `"single"` | — |
| `value` | string | no | — | — | Pressed value, or an array when type is multiple |
| `disabled` | boolean | no | — | `false` | — |
| `orientation` | enum(horizontal | vertical) | no | — | `"horizontal"` | — |
| `variant` | enum(default | outline) | no | — | `"default"` | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `name` | string | no | — | — | — |
| `onValueChange` | event | no | — | — | — |
| `class` | string | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Alignment (`align`)

```json
{
  "type": "single",
  "value": "start"
}
```

### Related

- [`button-group`](button-group.md)
- [`radio-group`](radio-group.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
