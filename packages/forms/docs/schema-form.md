# `SchemaForm` (`@texuli/forms`)

The Svelte 5 view: it paints any validated schema with texuli controls.

```svelte
<script lang="ts">
import { SchemaForm, createWebStorageDrafts, validateFormSchema } from '@texuli/forms';

const result = validateFormSchema(schema);
const drafts = { storage: createWebStorageDrafts(localStorage), key: 'registration' };
</script>

{#if result.ok}
  <SchemaForm
    form={result.form}
    {drafts}
    validators={{ uniqueEmail: async (value, { signal }) => (await taken(value, signal)) ? 'Already registered.' : null }}
    onSubmit={async ({ values, files }) => {
      await send(values, files);
      return { ok: true };
    }}
  />
{/if}
```

The root re-exports the model's main entry points (`validateFormSchema`,
`createFormController`, `createWebStorageDrafts`, `createMemoryDrafts` and
the `CompiledForm`, `FormController`, `FormDraftOptions`,
`FormDraftStorage`, `FormSchema`, `FormSubmitResult`, `FormValidator` and
`FormValues` types) and `FORMS_PACKAGE_VERSION`.

## Props

| Prop | Meaning |
| --- | --- |
| `form` | A `CompiledForm` from `validateFormSchema`; a new form builds a new internal controller (see below) |
| `controller` | Drive the form from your own `FormController` (made for the same form; the view paints `controller.form`) |
| `values` | Starting values (coerced per field) |
| `validators` | Host validators by the names fields give |
| `drafts` | `FormDraftOptions`: storage, key and debounce for autosave |
| `restoreDraft` | Restore a saved draft on mount (default `true` with `drafts`) |
| `onSubmit` | Receives a `SchemaFormSubmission`: `values` (visible, enabled fields) and `files` (the `File`s of submitted file fields); may return server errors |
| `onValueChange` | Called after each change with the name, the new value and every value |
| `labels` | Interface text (`SchemaFormLabels`, defaults in `DEFAULT_SCHEMA_FORM_LABELS`); `progress` names the step navigation and fills `{title}` with the form title (default `{title} progress`), so two multi-step forms on a page have distinct landmarks |
| `messages` | Validation messages (`FormMessages`) |
| `headingLevel` | Level of the form title (2–6, default 2); step and summary headings go one deeper |
| `now` | The host clock (`today()` in conditions, draft times) |
| `motion` | Step transitions through `texuli/motion` (default a fast fade; `false` turns it off) |
| `ref` | The `<form>` element (bindable) |
| `class` | Classes on the form; other attributes (`id`, `aria-label`, `data-*`) reach the form too |

With `id="signup"`, the form's own parts are `signup-title`,
`signup-description` and `signup-summary`, and each field's control is
`signup-field-<name>` (its error `signup-field-<name>-error`), so no field
name collides with the form's ids.

## Changing the form

Without a `controller`, passing a new `form` builds a new internal
controller and destroys the old one: values start over from `values`,
errors, the error summary, kept files and the status line are cleared, and
steps and validation follow the new form. With `drafts`, the new controller
restores the saved draft under its `key` (coerced to the new form's fields)
and autosaves there; an autosave still pending on the old controller is
dropped. Give each form its own drafts `key` when forms should not share a
draft. To keep values across a form change, read them in `onValueChange`
and pass them back as `values`.

With a `controller`, the view paints `controller.form`, so structure and
state always agree; a `form` prop that differs from `controller.form` logs
a `console.warn`. Swapping in another controller re-subscribes the view;
the view never destroys a controller it did not create.

## Controls

Each field is the texuli control for its type: `Input` (text, email, url,
number), `Textarea`, `DatePicker`, `TimeField`, `Select`, `RadioGroup`,
`Checkbox` (also each choice of a multiselect), `Switch`, `Slider`,
`TagsInput` and `FileUpload`. Text-like controls sit in a texuli `Field`,
so by the Field rule the label, description and error reach the focusable
control (`<label for>`, `aria-describedby`, `aria-invalid`); radio and
multiselect are a `fieldset` with a `legend`; checkbox and switch carry
their own label. Errors are texuli `FieldError`s (`role="alert"`). Hidden
fields are not rendered; disabled ones are disabled controls. A file field
keeps the `File`s in the view and gives the controller their metadata;
uploading is the host's (`onSubmit` receives the files).

## Behavior

- **A named form landmark**: `<form novalidate>` labelled by its title (or
  by an `aria-label`), with its description linked.
- **Steps**: a texuli `Stepper` shows progress (completed steps are
  clickable); Next validates the current step. Each new step heading takes
  focus and the polite status line announces "Step 2 of 3: Attendance".
  Steps whose condition does not hold are skipped.
- **Errors**: when Next or Submit finds problems, an error summary takes
  focus, says how many answers need attention and links to each field
  (activating a link focuses the control); each field shows its error,
  linked to the control.
- **Keyboard-complete**: the native order; Enter in a field moves to the
  next step or submits; Back, Next and Submit are buttons; every control is
  a keyboard-operable texuli control.
- **Host validators** show "Checking…" (linked to the control) while they
  run.
- **Drafts**: "Draft saved" appears after each autosave (not announced, to
  keep the status line quiet); a restored draft is announced once.
- **Submit**: the Submit button shows a loading state; a success message
  takes focus; server errors show like local ones.
- **Motion**: step changes fade in through `texuli/motion`; reduced motion
  and the `none` level make them instant, and nothing animates on the
  server or on hydration.

Tests: `packages/forms/tests/view.test.ts` (every field type named by its
label with no name or ARIA violations under axe, the error summary and its
links, step focus and announcements, conditional fields, submission with
files, drafts and localized labels, a new form rebuilding the controller,
and the warning for a controller made for another form).
