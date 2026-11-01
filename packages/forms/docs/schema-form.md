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
`formatFormValue`, `formValuesToMarkdown` and the `CompiledForm`,
`FormController`, `FormDraftOptions`, `FormDraftStorage`, `FormSchema`,
`FormStepContext`, `FormStepResult`, `FormSubmitResult`, `FormValidator`
and `FormValues` types), the view's types (`SchemaFormActions`,
`SchemaFormCustomField`, `SchemaFormCustomEntry`, `SchemaFormCustomFields`,
`SchemaFormCustomSnippet`, `SchemaFormControl`, `SchemaFormControlProps`,
`SchemaFormControls`, `LazyControlType`), `LAZY_CONTROL_TYPES` and
`FORMS_PACKAGE_VERSION`.

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
| `hideTitle` | Hide the title visually (G114); it stays in the page and keeps naming the form |
| `actions` | The action row (G115): a snippet given `SchemaFormActions`, or `false` for none |
| `disabled` | Disable the whole form (G116): every control and action; a host submit still sends the values |
| `readOnly` | Show the values read-only (G116): text inputs are `readonly`, other controls disabled, Submit disabled |
| `onStep` | A hook when a step validated and the person moves forward (G120); may block with errors or a message |
| `controls` | Controls by field type (G119); `SCHEMA_FORM_CONTROLS` from `@texuli/forms/controls` paints them all at once (SSR) |
| `field` | A snippet that paints every `custom` field without an entry in `customFields` (G113) |
| `customFields` | Custom field painters keyed by field name or kind (the name wins): a snippet, or `{ render?, component?, validate? }` (G113) |
| `customValidators` | Validators of custom fields keyed by field name or kind, for painters given as plain snippets (G113) |
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
number; password with a reveal toggle; otp), `Textarea`, `DatePicker`,
`TimeField` (datetime is both), `Select`, `RadioGroup`, `Checkbox` (also
each choice of a multiselect), `Switch`, `Slider`, `TagsInput`,
`ColorPicker` and `FileUpload`; a `custom` field is the host's. A text field with `format: 'phone'` renders
`type="tel"` with `inputmode="tel"`, so phones open the dial pad (G131, from `0.11.3`). Text-like controls sit in a texuli `Field`,
so by the Field rule the label, description and error reach the focusable
control (`<label for>`, `aria-describedby`, `aria-invalid`); radio and
multiselect are a `fieldset` with a `legend`; checkbox and switch carry
their own label. Errors are texuli `FieldError`s (`role="alert"`). Hidden
fields are not rendered; disabled ones are disabled controls. A file field
keeps the `File`s in the view and gives the controller their metadata;
uploading is the host's (`onSubmit` receives the files).

## Loading controls per field type (G119)

Text, textarea, number, email, url, password, otp, select, multiselect,
checkbox and switch controls are in `SchemaForm`'s own bundle. The date,
time, datetime, slider, tags, file, color and radio controls
(`LAZY_CONTROL_TYPES`) and the step navigation of multi-step forms each
load, with their CSS, the first time a form uses them; the form loads all
of its types when it mounts, and a loaded control is kept for every later
form. Until a control arrives its place holds a
`.tx-forms__control-loading` box sized like the control at the default
density (`aria-busy`, "Loading…" for screen readers), so the layout does not
shift when it mounts; `tests/e2e/site-forms.spec.ts` holds every lazy type's
placeholder to its mounted control's block size on chromium, webkit and a
phone.

**Readiness.** While any control the form uses (or its step navigation) is
still loading, the form carries `data-tx-pending` and `aria-busy="true"`,
and so does each placeholder. Wait for
`form:not([data-tx-pending])` (or for no `[data-tx-pending]` inside the
host) before a screenshot or a test that reads the controls; the visual
suite does this for every example.

Measured with `packages/forms/tests/bundle-graph.test.ts` (Vite,
minified, gzip -9, `svelte` external), a host with one text, select and
checkbox form went from 90,507 B of initial JavaScript and 9,385 B of CSS
to 60,048 B and 5,266 B, and a host with a text-only form from 90,466 B and
9,385 B to 60,011 B and 5,266 B: neither has any slider, tags, color, date,
time, file or radio code or CSS in its initial graph.

**Server rendering.** On the server a lazy control renders as its
placeholder, and the browser loads it after hydration. To render every
control on the server, pass the static registry:

```svelte
<script lang="ts">
import { SchemaForm } from '@texuli/forms';
import { SCHEMA_FORM_CONTROLS } from '@texuli/forms/controls';
</script>

<SchemaForm {form} controls={SCHEMA_FORM_CONTROLS} />
```

`controls` may also hold any subset (`{ date: MyDateControl }`): a given
control wins over the lazy one. See
[controls](https://github.com/DailybotHQ/texuli/blob/main/packages/forms/docs/controls.md).

## Host-painted fields (G113)

A `custom` field (`{ type: 'custom', kind: 'relation', ... }`) is painted
by the host, inside the form: in schema order, with the form's label,
description and error around it, in the error summary, focused on error,
validated and submitted with the rest. Paint it with the `field` snippet,
or with `customFields` keyed by field name or kind (the name wins); each
entry is a snippet or `{ render?, component?, validate? }`. The painter
receives a `SchemaFormCustomField`: the `field`, `name`, `kind`, `config`,
`value`, `setValue(value)`, `blur()`, `error`, `invalid`, `required`,
`disabled`, `readOnly`, `pending`, the ids (`id`, `labelId`,
`describedBy`) and `props` to spread on the focusable control (`id`,
`aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`,
`disabled`), so the label and the summary links reach it.

```svelte
{#snippet relation(ctx)}
  <CustomerPicker {...ctx.props} value={ctx.value} onchange={(id) => ctx.setValue(id)} onblur={ctx.blur} />
{/snippet}

<SchemaForm
  {form}
  field={relation}
  customValidators={{ relation: async (value) => ((await exists(value)) ? null : 'Pick an existing customer.') }}
/>
```

A custom field with no painter shows "This field cannot be shown here."
(`labels.customMissing`). Agent output may declare a custom field only of a
kind the host registered (see the model and host docs).

## The title (G114)

`hideTitle` keeps the title in the page but visually hidden
(`.tx-forms__visually-hidden`), so it still names the form landmark
(`aria-labelledby`); an `aria-label` replaces it as the name either way.

## Actions and submitting from outside (G115)

`actions` replaces the Back, Next and Submit row with a snippet that
receives `SchemaFormActions`: `submitting`, `disabled`, `readOnly`, `last`,
`step`, `steps`, `submitLabel`, and `back()`, `next()` and `submit()`
(Next on an earlier step, submit on the last). `actions={false}` paints no
row. Every way to submit runs the same validation and opens the error
summary (or focuses the confirmation):

- an outside button: `<button type="submit" form="<the form id>">`;
- the component's `requestSubmit()` (`bind:this`), or the form element's
  `requestSubmit()` (`ref`);
- `controller.submit()` on a controller passed as `controller`: the view
  opens the summary when a submit fails, whoever started it.

## Disabled and read-only (G116)

`disabled` disables every control (custom fields get `disabled`), the
action row and the step navigation. It is presentation: a host can still
set values and submit (`requestSubmit()`, `controller.submit()`), and the
values of every visible field are sent, unlike a field disabled by
`when.enable`. `readOnly` makes text inputs `readonly` (still focusable
and selectable), disables controls with no native read-only state, keeps
Back and Next, and disables Submit. Both also follow the controller's
`disabled` and `readOnly` state.

## Password, one-time code, color and datetime (G117)

- **Password**: an `Input type="password"` with `autocomplete`
  `current-password` (or the field's `new-password`, or `off` for a simulated
  password the browser must not save) and a "Show password"
  toggle button (`aria-pressed`, `aria-controls`) that switches it to text.
- **One-time code**: one input (not split boxes, so screen readers and
  paste work) with `autocomplete="one-time-code"`, `inputmode="numeric"`
  and `maxlength` of the field's `length`; spaces are dropped as you type.
- **Color**: the texuli `ColorPicker` in hex; the answer stays empty until
  a color is picked.
- **Datetime**: a `DatePicker` and a `TimeField` named "Starts Date" and
  "Starts Time" (`labels.date`, `labels.time`); the value is set once both
  parts are there.

## Clearable selects (G118)

An optional select gets a first "None" choice (`labels.selectNone`) that
clears the answer back to empty; the trigger then shows the placeholder. A
required select has none. The field's `clearable` overrides the default
(`false` removes the choice from an optional select, `true` adds it to a
required one).

## The per-step hook (G120)

`onStep({ step, position, values, allValues, signal })` runs when a step
validated and Next (or a later step in the progress) is chosen. While it
runs, Next shows its loading state ("Checking…"). Return nothing or
`{ ok: true }` to move on, or `{ ok: false, errors?, message? }` to stay:
field errors show on their fields, the message joins the error summary,
and the summary takes focus.

## Url fields and http (G121)

A url field accepts `https:` only unless its schema says
`protocols: ['http', 'https']` (or `['http']`); `javascript:`, `data:` and
every other scheme are always refused, and an http answer passes the same
untrusted URL policy as its https twin.

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

Tests: `packages/forms/tests/view-gaps.test.ts` (the 0.10.0 gaps above,
with axe), `packages/forms/tests/bundle-graph.test.ts` (G119),
`packages/forms/tests/ssr.test.ts` and `packages/forms/tests/view.test.ts`
(every field type named by its label with no name or ARIA violations under
axe, the error summary and its
links, step focus and announcements, conditional fields, submission with
files, drafts and localized labels, a new form rebuilding the controller,
and the warning for a controller made for another form).
