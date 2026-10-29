# `@texuli/forms/model`

The framework-free forms runtime (ADR-015): the closed form schema and its
validator, named formats, conditional logic on `@texuli/core/expression`,
the closed validation rules, drafts and the form controller. It imports no
UI framework, so Node, agents, tests and any view can use it.

```ts
import { createFormController, validateFormSchema } from '@texuli/forms/model';

const result = validateFormSchema(schemaFromAnAgent); // untrusted tier by default
if (result.ok) {
  const controller = createFormController(result.form, {
    onSubmit: async ({ values }) => {
      await save(values);
      return { ok: true };
    },
  });
  controller.setValue('email', 'ada@example.com');
  const outcome = await controller.submit();
}
```

## The schema

A `FormSchema` has a `title`, an optional `description` and `submitLabel`,
exactly one of `fields` (one page), `sections` (`FormSection`: groups, a
fieldset when titled) or `steps` (`FormStep`: a multi-step flow, each step
with fields or sections), and optional cross-field `rules` (`FormRule`).

A `FormField` has a `name` (`FORM_NAME`, unique in the form, and never one
of `FORM_RESERVED_NAMES`, the `Object.prototype` members such as
`toString` or `constructor` that the pattern would accept), a `type`
(`FormFieldType`, one of `FORM_FIELD_TYPES`), a `label` and optionally:

| Member | Applies to | Meaning |
| --- | --- | --- |
| `description`, `link` (`FormLink`) | every type | Help text, and a help link whose `href` passes `safeHref` at the schema's tier |
| `placeholder` | text types, number, select, tags | Placeholder text |
| `default` | every type but file | A value of the field's type (`FormValue`) |
| `options` (`FormOption`) | select, radio, multiselect | The closed choices (at most 200, unique values) |
| `required`, `when` (`FormWhen`) | every type | Static requirement; `show`, `require`, `enable` conditions |
| `minLength`, `maxLength` | text types, tags (per tag) | Length in code points |
| `min`, `max` | number and slider (numbers), date (`YYYY-MM-DD`), time (`HH:MM`) | Range |
| `step` | number, slider | Increments from `min` (or 0) |
| `minItems`, `maxItems` | multiselect, tags, file | List size |
| `format` (`FormFormat`) | text, textarea, tags | A named format (`FORM_FORMATS`); email and url fields imply theirs |
| `validator` | every type | The name of a host validator (`FORM_VALIDATOR_NAME`) |
| `messages` | every type | Plain-text overrides by rule (`FormRuleName`, `FORM_RULE_NAMES`) |
| `rows` | textarea | Visible rows (2–20) |
| `accept`, `maxSize` | file | MIME types or extensions, and the largest file in bytes |
| `autocomplete` (`FormAutocomplete`) | text types, number, date, select | A token of `FORM_AUTOCOMPLETE` (no payment, credential or one-time-code tokens) |

Steps and sections have ids (`FORM_ID`) and an optional `when.show`. The
caps are in `FORM_LIMITS` (200 fields, 20 steps, 50 sections, 50 rules,
200 options, text lengths, 10,000 characters per answer).

**No patterns, no code.** Formats are names checked by owned linear-time
code (`matchesFormat`): `email`, `url` (https only, through the untrusted
URL policy), `phone`, `postal-code` and per-country postal codes, `digits`,
`alphanumeric`, `slug`, `iso-date`, `time`, `hex-color`. A host validator
is a name the host registered; a schema can only name it.

## Validating a schema

`validateFormSchema(input, options)` (`FormSchemaOptions`: `tier`,
`untrusted` by default, and the host's `validators` list) returns a
`FormSchemaResult`: a `CompiledForm` (the frozen `schema`, `fields` as
`CompiledField`s in document order, `byName`, `sections` as
`CompiledSection`s, `steps` as `CompiledStep`s, `rules` as `CompiledRule`s,
`multiStep`), or `FormSchemaIssue`s (a `FormSchemaIssueCode`, a JSON
`path`, a `message`). It refuses unknown members (a `pattern` included),
members that do not apply to the field type, duplicate names and ids,
defaults of the wrong type or outside the options, control characters,
links the URL policy refuses, and conditions or rules that are not valid,
boolean expressions of the core language over declared fields. A
condition may read only fields declared before it (`forward-reference`),
so visibility resolves in one pass with no cycles; rules may read any
field. The walk is linear in the schema, and the caps bound it.

`checkFormDraft(schema, tier, validators)` is the adapter `validateDraft`
takes as `checkForm` (`@texuli/catalog/validate`, spec 0.8.0): a host that
validates agent blueprints passes it, and `@texuli/player` loads it on
demand when a blueprint holds a `schema-form` node.

## Values

`FormValue`s are typed: strings for text, textarea, email, url, select and
radio; numbers (or `null`) for number and slider; `YYYY-MM-DD` and `HH:MM`
strings (or `null`) for date and time; booleans for checkbox and switch;
string lists for multiselect and tags; `FormFile` metadata (`name`, `size`,
`type`, an optional host `ref`) for file. `FormValues` maps names to them.
`coerceValue(field, raw)` coerces an outside value (or returns
`undefined`), `emptyValue(field)` is a field's empty value,
`isEmptyValue(value)` is the `required` test (an unchecked checkbox is
empty) and `expressionTypeOf(type)` is the type conditions see.

## Logic and validation

- `computeFormLogic(form, values, options)` (`FormLogicOptions`: `now`,
  `budget`) returns a `FormLogicState`: `FormFieldState` per field
  (`visible`, `required`, `enabled`) and the visible sections and steps.
  One pass in document order with one expression budget; a hidden or
  disabled field reads as empty to the fields after it. Only `true` holds:
  a condition over an empty answer is unknown and does not show, require or
  enable.
- `checkFieldValue(field, value, required, messages)` is the first
  closed-rule problem of one value; `validateFormValues(form, values,
  options)` returns a `FormValidation` (`errors` by field, `formErrors`)
  for the visible, enabled fields and the cross-field rules. A rule fails
  only when its test is `false`.
- `submittedValues(form, values, logic)`: visible, enabled fields only.
- Messages: `DEFAULT_FORM_MESSAGES` (`FormMessages`), filled by
  `formatMessage` (plain text, no patterns).

## The controller

`createFormController(form, options)` (`FormControllerOptions`: `values`,
`validators`, `messages`, `drafts`, `onSubmit`, `now`, `timers`) returns a
`FormController`:

- `getState()` and `subscribe(listener)`: a `FormState` with `values`,
  `errors` (shown once a field was blurred or its step or the form was
  checked), `formErrors`, `touched`, `logic`, the visible `steps`
  (`FormStepState`), the current `step`, the `status` (`FormStatus`:
  `editing`, `validating`, `submitting`, `submitted`, `failed`), the
  `pending` host validators, the `draft` status (`FormDraftStatus`) and
  `submitCount`.
- `setValue` (coerced; a field with an error is checked again so the error
  clears as it is fixed), `blur`, `validateStep`, `next`, `back`, `goTo`
  (forward moves validate each step), `submit` (a `FormSubmitOutcome`),
  `reset` and `destroy`.
- **Host validators** (`FormValidator`): sync or async, given the value,
  the name, every value and an `AbortSignal`; a newer run aborts an older
  one, and results for values that moved on are discarded. A name the host
  did not register fails closed ("cannot be checked").
- **Submit**: closed rules, cross-field rules, then host validators; then
  `onSubmit` with a `FormSubmission` (visible, enabled values). It may
  return nothing or `{ ok: true }`, or a `FormSubmitResult` with server
  `errors` by field and a `message`.
- **Drafts and autosave** (`FormDraftOptions`: a `FormDraftStorage`, a
  `key`, `debounceMs`, default 800): every change schedules a save
  (`FormTimers` are injectable); `saveDraft`, `restoreDraft` and
  `clearDraft` (also after a successful submit). A `FormDraft` holds the
  values (never files), the step and the time. Restored drafts are
  untrusted: values are coerced field by field and unknown names dropped.
  `createWebStorageDrafts(localStorage)` and `createMemoryDrafts()` are
  ready-made adapters; storage failures set the draft status to `error`
  and never throw.

Tests: `packages/forms/tests/model.test.ts` (schema refusals, hostile
schemas in linear time, every format, coercion, logic, validation, the
controller, drafts).
