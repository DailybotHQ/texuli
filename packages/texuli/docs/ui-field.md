# Component: Field, Label, Description, FieldError and Form

**Package:** `texuli`  
**Source:** `packages/texuli/src/components/field/`  
**Tests:** `packages/texuli/tests/forms.test.ts`  
**Example:** `texuli-field`  
**Task:** T-ui-field

## Import

```ts
import {
  Field,
  Label,
  Description,
  FieldError,
  Form,
  toFieldErrorMap,
  fieldMessage,
  useFieldLabel,
} from 'texuli/field';
```

## Field

Layout wrapper that wires label, description, error and control ARIA.

| Prop | Notes |
| --- | --- |
| `label` | Visible (or `hideLabel` for sr-only) |
| `description` | Optional help text |
| `error` | When set, control gets `aria-invalid` and an alert error |
| `required` / `disabled` | Field chrome + control props |
| `orientation` | `vertical` (default) \| `horizontal` |
| `children` | Snippet receiving `FieldControl` — spread `control.props` onto the input |

### Custom controls: `useFieldLabel`

A control you build from primitives (a segmented group, a set of toggle
buttons) can read the enclosing Field the way DatePicker, DateRangePicker and
TimeField do. `useFieldLabel()` (also exported as `getFieldLabelContext()`)
returns `{ id, labelId }` inside a Field and `undefined` outside one. Call it
while the component initializes (it reads Svelte context):

```svelte
<script lang="ts">
  import { useFieldLabel } from 'texuli/field';
  const field = useFieldLabel();
</script>

<div role="group" aria-labelledby={field?.labelId}>…</div>
```

- `labelId` is the Field label's id: name a group with
  `aria-labelledby={field?.labelId}`.
- `id` is the control id the label's `for` points at: put it on the first
  focusable element when you do not spread `control.props` there.
- Hide your own visible label when `field` is defined, so it is not shown
  twice. The type is `FieldLabelContext`.

## Form

Schema-agnostic submit pipeline:

1. Optional native `checkValidity` (unless `noValidate`)
2. `onValidate(values, form)` → field→message map
3. `onSubmitValues` when valid
4. `_form` key surfaces as a form-level alert

Helpers: `toFieldErrorMap`, `formDataToRecord`, `applyNativeCustomValidity`, `fieldMessage`.

A message from a failed submit is cleared as soon as the user edits that
control. The browser checks constraints before `submit` fires, so a stale
message would otherwise block every later submit when native validation is
on (the default).

## Tokens

CSS in `@layer tx.components` (`field.css`). Logical properties; destructive color for errors and required markers.
