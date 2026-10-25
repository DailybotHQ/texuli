# Select

> A single-value select root with size and variant chrome.

- **id:** `select`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Pick one value from a moderate closed list

### Don't use when

- A short exclusive set that fits on the page (use radio-group)
- Free text with suggestions (use combobox)

### Accessibility

- Trigger is a real button; listbox opens on ArrowDown/Enter/Space
- Typeahead highlights matching items; Escape closes and restores focus

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `open` | boolean | no | — | `false` | — |
| `value` | string | no | — | — | — |
| `defaultValue` | string | no | — | — | — |
| `name` | string | no | — | — | — |
| `disabled` | boolean | no | — | `false` | — |
| `required` | boolean | no | — | `false` | — |
| `form` | string | no | — | — | Associated form id |
| `type` | enum(single) | no | — | `"single"` | — |
| `items` | array | no | — | — | Optional value/label catalog when items are not registered by Select.Item |
| `sideOffset` | number | no | — | `4` | — |
| `positioning` | boolean | no | — | `true` | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `variant` | enum(outline | soft) | no | — | `"outline"` | — |
| `onOpenChange` | event | no | — | — | — |
| `onValueChange` | event | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Outline select (`outline`)

```json
{
  "size": "md",
  "variant": "outline",
  "defaultValue": ""
}
```

### Related

- [`select-trigger`](select-trigger.md)
- [`select-value`](select-value.md)
- [`select-content`](select-content.md)
- [`select-item`](select-item.md)
- [`radio-group`](radio-group.md)
- [`field`](field.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
