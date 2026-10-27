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
