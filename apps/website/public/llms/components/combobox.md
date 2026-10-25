# Combobox

> A text input that filters a list of options, for one value or several.

- **id:** `combobox`
- **package:** `texuli`
- **tier:** `app`
- **agent emittable:** no
- **emit:** 
- **group:** `forms`

### Use when

- Pick from a long list by typing to filter
- Options loaded from a server as the user types

### Don't use when

- A short closed list (use select or radio-group)
- Several values shown as chips (use multi-select)

### Accessibility

- The input keeps focus; aria-activedescendant tracks the highlighted option
- Arrow keys move, Enter selects, Escape closes; empty, loading and error states are announced
- With required, a rejected form moves focus to the input

### Props

| Name | Kind | Required | Trust | Default | Description |
| --- | --- | --- | --- | --- | --- |
| `value` | unknown | no | — | — | Selected value (a string, or a string array when multiple) |
| `defaultValue` | unknown | no | — | — | Starting selection; a form reset restores it |
| `inputValue` | string | no | — | — | Text in the input (bindable) |
| `defaultInputValue` | string | no | — | `""` | — |
| `items` | array | no | — | — | Options as { value, label, disabled? } |
| `loadOptions` | unknown | no | — | — | Function prop the host passes: (query, signal) => Promise<items> for remote options. Not agent-emittable (functions are not data). |
| `filter` | unknown | no | — | — | Function prop the host passes: (item, query) => boolean. Replaces the default match (label contains the query, ignoring case); runs on the trimmed, non-empty query; unused with loadOptions. createFoldedFilter builds an accent-insensitive one. Not agent-emittable (functions are not data). |
| `multiple` | boolean | no | — | `false` | — |
| `disabled` | boolean | no | — | `false` | Not interactive, not submitted, not validated |
| `name` | string | no | — | — | Form field name: submits the value (one entry per value when multiple) |
| `required` | boolean | no | — | `false` | Blocks form submission until a value is selected |
| `requiredMessage` | string | no | — | — | Translated message when required blocks submission (default: the browser message) |
| `form` | string | no | — | — | Associated form id |
| `open` | boolean | no | — | `false` | — |
| `size` | enum(sm | md | lg) | no | — | `"md"` | — |
| `variant` | enum(outline | soft) | no | — | `"outline"` | — |
| `class` | string | no | — | — | — |
| `onValueChange` | event | no | — | — | — |
| `onInputValueChange` | event | no | — | — | — |
| `onOpenChange` | event | no | — | — | — |
| `children` | slot | no | — | — | — |

### Examples

#### Required form field (`form-field`)

```json
{
  "name": "city",
  "required": true,
  "requiredMessage": "Choose a city.",
  "size": "md"
}
```

### Related

- [`multi-select`](multi-select.md)
- [`select`](select.md)
- [`field`](field.md)
- [`form`](form.md)

---

_Generated from the Texuli catalog manifest. Do not hand-edit; regenerate with `@texuli/tools/llms`._
