# Control and wrapper attributes (FIX-choice-aria)

Styled form components often wrap their focusable control (a checkbox button,
a text input, a slider thumb) in a field wrapper. Extra attributes you pass
split between the two, so an unlabeled control keeps its accessible name
(WCAG 4.1.2). A data table's "Select row" checkbox needs `aria-label` on the
button itself.

| Attribute | Goes to |
| --- | --- |
| `aria-*` (`aria-label`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-errormessage`, `aria-controls`…) | the **control** |
| `data-*` | the **control** |
| event handlers (`on*`) | the **control**, except where the component binds its own (see below) |
| `id`, `name`, `value`, `disabled`, `required`, `readonly`, `tabindex`, `title`, `autofocus`, `form`, `autocomplete`, `inputmode`, `placeholder` | the **control** |
| everything else (`style`, `hidden`, `dir`, `lang`…) | the **wrapper** |
| `class` | the wrapper when labeled, the control when unlabeled (the same rule as `ref`) |

A component's own `aria-describedby` (its description) is joined with yours,
not replaced. The helper is `splitControlProps` / `joinIds` in
`packages/texuli/src/internal/control-props.ts`.

## Per component

| Component | Control | Notes |
| --- | --- | --- |
| `Checkbox`, `Switch` | the `role=checkbox` / `role=switch` button | labeled: the wrapper takes the layout hooks; unlabeled: the solo span does |
| `Radio` | the `role=radio` item | card, labeled and unlabeled variants |
| `RadioGroup` | the `role=radiogroup` root | it is the control |
| `Input`, `Textarea`, `Select.Trigger`, `Combobox.Input`, `NumberField.Input`, `PinInput.Root` | the input / trigger | they already passed everything to the control |
| `Slider` | each thumb (`role=slider`) | `aria-label` names the thumb (several thumbs: "label 1", "label 2"); `label` / `thumbLabel` still work |
| `TextCounter` | the input or textarea | `ref` binds the wrapper root; layout hooks stay on it |
| `TagsInput` | the text input | `aria-label` replaces `inputLabel`; `label` still names the group |
| `Toggle`, `ToggleGroupItem` | the button | no wrapper |
| `Rating` (input) | the radio group | `aria-label` / `aria-labelledby` replace the visible label's name; handlers stay on the wrapper (the group binds its own) |
| `Rating` (display) | the `role=img` root | `aria-label` replaces the computed summary |
| `FileUpload` | the file input | `aria-*` / `data-*` only; handlers and layout stay on the drop zone |
| `DatePicker` | — | always labeled by its required `label`, with `description` and `error` props; it takes no free attributes |

Tests: `packages/texuli/tests/forms.test.ts`. For every component it
checks that `getByRole(role, { name })` finds the control by its
`aria-label`, that `aria-describedby` lands on it, and that axe reports no
name or ARIA-rule violations.
