<script lang="ts">
import { type Snippet, tick, untrack } from 'svelte';
import type { HTMLFormAttributes } from 'svelte/elements';
import { Button } from 'texuli/button';
import { type ClassValue, cx } from 'texuli/cx';
import { createPresenceMotion, type MotionProp } from 'texuli/motion';
import {
  createFormController,
  type FormController,
  type FormDraftOptions,
  type FormState,
  type FormStepContext,
  type FormStepResult,
  type FormSubmitResult,
  type FormValidator,
} from '../model/controller.ts';
import type { CompiledForm } from '../model/schema.ts';
import type { FormField, FormValues } from '../model/types.ts';
import { DEFAULT_FORM_MESSAGES, type FormMessages, formatMessage } from '../model/validate.ts';
import { loadControl, loadedProgress, loadProgress } from './controls/lazy.ts';
import { isLazyControlType, type SchemaFormControls } from './controls/types.ts';
import FormFieldControl from './FormFieldControl.svelte';
import {
  DEFAULT_SCHEMA_FORM_LABELS,
  type SchemaFormActions,
  type SchemaFormCustomEntry,
  type SchemaFormCustomFields,
  type SchemaFormCustomSnippet,
  type SchemaFormLabels,
  type SchemaFormSubmission,
} from './labels.ts';
import '../styles.css';

interface Props extends Omit<HTMLFormAttributes, 'onsubmit' | 'class' | 'children'> {
  /**
   * A validated form (`validateFormSchema(schema).form`). A new form builds a
   * new internal controller (values start over from `values`).
   */
  form: CompiledForm;
  /**
   * Drive the form from your own controller, made for the same `form`. The
   * view shows `controller.form`; a different `form` prop logs a warning.
   */
  controller?: FormController | null;
  /** Starting values (coerced per field). */
  values?: Readonly<Record<string, unknown>>;
  /** Host validators by the names fields give in `validator`. */
  validators?: Readonly<Record<string, FormValidator>>;
  /** Drafts and autosave through a host storage adapter. */
  drafts?: FormDraftOptions | null;
  /** Restore a saved draft when the form mounts (default true when `drafts` is set). */
  restoreDraft?: boolean;
  onSubmit?: (
    submission: SchemaFormSubmission
  ) => FormSubmitResult | undefined | Promise<FormSubmitResult | undefined>;
  /** Called after each change with the field name, its new value and every value. */
  onValueChange?: (name: string, value: unknown, values: FormValues) => void;
  labels?: Partial<SchemaFormLabels>;
  messages?: Partial<FormMessages>;
  /** Level of the form title (2–6); step and summary headings go one deeper. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** The host clock (`today()` in conditions, draft times). */
  now?: () => number;
  /** Step transitions through `texuli/motion` (default a fade; `false` turns it off). */
  motion?: MotionProp;
  /**
   * Hide the title visually (G114). It stays in the page, visually hidden,
   * and keeps naming the form (`aria-labelledby`) unless an `aria-label` is given.
   */
  hideTitle?: boolean;
  /**
   * The action row (G115): a snippet that paints your own buttons from
   * `SchemaFormActions`, or `false` for none (submit with an outside
   * `<button form="<id>">`, `requestSubmit()` on the component, or the
   * form element's `requestSubmit()`; each validates and opens the error
   * summary).
   */
  actions?: Snippet<[SchemaFormActions]> | false;
  /**
   * Disable the whole form (G116): every control and action is disabled.
   * Values still submit when the host submits (`requestSubmit()`).
   */
  disabled?: boolean;
  /** Show the values read-only (G116): text is read-only, other controls are disabled, Submit is disabled. */
  readOnly?: boolean;
  /**
   * Runs when a step validated and the person moves forward (G120); return
   * `{ ok: false, errors?, message? }` to keep them on the step. Next shows
   * a loading state while it runs.
   */
  onStep?: (
    context: FormStepContext
  ) => FormStepResult | undefined | Promise<FormStepResult | undefined>;
  /**
   * Controls by field type (G119). Without it, date, time, datetime, slider,
   * tags, file, color and radio controls load on first use; pass
   * `SCHEMA_FORM_CONTROLS` from `@texuli/forms/controls` to render them at
   * once (server rendering).
   */
  controls?: SchemaFormControls;
  /** Paints every `custom` field without an entry in `customFields` (G113). */
  field?: SchemaFormCustomSnippet;
  /** Custom field painters, keyed by field name or kind (the name wins), with their validators. */
  customFields?: SchemaFormCustomFields;
  /** Validators of custom fields keyed by field name or kind, for painters given as snippets. */
  customValidators?: Readonly<Record<string, FormValidator>>;
  ref?: HTMLElement | null;
  class?: ClassValue;
}

let {
  form: formProp,
  controller: external = null,
  values: initial,
  validators,
  drafts = null,
  restoreDraft = true,
  onSubmit,
  onValueChange,
  labels: labelOverrides,
  messages,
  headingLevel = 2,
  now,
  motion,
  hideTitle = false,
  actions,
  disabled: disabledProp = false,
  readOnly: readOnlyProp = false,
  onStep,
  controls,
  field: fieldSnippet,
  customFields,
  customValidators,
  ref = $bindable(null),
  class: className,
  id,
  ...rest
}: Props = $props();

const uid = $props.id();
const base = $derived(id ?? `tx-forms-${uid}`);
const labels = $derived<SchemaFormLabels>({ ...DEFAULT_SCHEMA_FORM_LABELS, ...labelOverrides });
const files = $state<Record<string, File[]>>({});

/** Validators of custom fields: the `customValidators` prop, then each entry's `validate`. */
function customChecks(): Record<string, FormValidator> {
  const out: Record<string, FormValidator> = { ...customValidators };
  for (const [key, entry] of Object.entries(customFields ?? {})) {
    if (typeof entry === 'object' && entry !== null && typeof entry.validate === 'function')
      out[key] = entry.validate;
  }
  return out;
}

/** The internal controller for one compiled form (options are read once, untracked). */
function build(compiled: CompiledForm): FormController {
  return untrack(() =>
    createFormController(compiled, {
      customValidators: customChecks(),
      disabled: disabledProp,
      readOnly: readOnlyProp,
      // Read at call time, so a new `onStep` prop is used.
      ...(onStep ? { onStep: (context: FormStepContext) => onStep?.(context) } : {}),
      ...(initial ? { values: initial } : {}),
      ...(validators ? { validators } : {}),
      ...(messages ? { messages: { ...DEFAULT_FORM_MESSAGES, ...messages } } : {}),
      ...(drafts ? { drafts } : {}),
      ...(now ? { now } : {}),
      onSubmit: (submission) => {
        const sent: Record<string, readonly File[]> = {};
        for (const [name, list] of Object.entries(files)) {
          if (submission.values[name] !== undefined) sent[name] = [...list];
        }
        return onSubmit?.({ values: submission.values, files: sent });
      },
    })
  );
}

// A new `form` (or `controller`) swaps the controller; the subscription
// effect below destroys the internal one it replaced.
const controller: FormController = $derived(external ?? build(formProp));
// The view always paints the controller's form, so structure and state agree.
const form = $derived(controller.form);

$effect(() => {
  if (external && external.form !== formProp && typeof console !== 'undefined') {
    console.warn(
      'SchemaForm: `controller` was made for another form; the controller form is shown. Pass `controller.form` as `form`, or no controller.'
    );
  }
});

/** The last state heard, tagged with the controller it came from. */
let observed = $state.raw<{ controller: FormController; state: FormState } | null>(null);
const formState = $derived(
  observed && observed.controller === controller ? observed.state : controller.getState()
);
let live = $state('');
let summaryOpen = $state(false);
let summary = $state<HTMLElement | null>(null);
let stepHeading = $state<HTMLElement | null>(null);
let panel = $state<HTMLElement | null>(null);
let done = $state<HTMLElement | null>(null);
/** The step last painted, so only a step change animates. */
let shownStep: number | null = null;
/** The submit count last answered with a summary or a confirmation. */
let handledSubmit = 0;

$effect(() => {
  const current = controller;
  const owned = current !== untrack(() => external);
  untrack(() => {
    // A swapped controller starts the view over: no summary, files or announcement.
    summaryOpen = false;
    live = '';
    shownStep = null;
    handledSubmit = current.getState().submitCount;
    for (const name of Object.keys(files)) delete files[name];
  });
  const stop = current.subscribe((next) => {
    observed = { controller: current, state: next };
  });
  observed = { controller: current, state: current.getState() };
  return () => {
    stop();
    if (owned) current.destroy();
  };
});

$effect(() => {
  const current = controller;
  if (!drafts || !restoreDraft) return;
  void untrack(() => current.restoreDraft()).then((restored) => {
    if (restored) live = labels.draftRestored;
  });
});

const presence = createPresenceMotion({
  motion: () => motion,
  defaults: { enter: 'fade', exit: false, layout: false, duration: 'fast' },
});
$effect(() => {
  const step = formState.step;
  const node = panel;
  if (!node) return;
  if (shownStep !== null && shownStep !== step) presence.enter(node);
  shownStep = step;
});

const steps = $derived(formState.steps);
const position = $derived(formState.step);
const current = $derived(steps[position]);
const compiledStep = $derived(form.steps[current?.index ?? 0]);
const last = $derived(position >= steps.length - 1);
const submitting = $derived(formState.status === 'submitting' || formState.status === 'validating');
const formDisabled = $derived(disabledProp || formState.disabled);
const formReadOnly = $derived(readOnlyProp || formState.readOnly);
const submitLabel = $derived(form.schema.submitLabel ?? labels.submit);
const title = $derived(form.schema.title);
const level = $derived(Math.min(6, Math.max(2, headingLevel)));
const sub = $derived(Math.min(6, level + 1));

/** Errors on the current step (and form-level errors on the last), in document order. */
const stepErrors = $derived(
  (compiledStep?.fields ?? [])
    .filter((name) => formState.errors[name])
    .map((name) => ({
      name,
      label: form.byName.get(name)?.field.label ?? name,
      message: formState.errors[name] as string,
    }))
);
const problems = $derived(
  stepErrors.length +
    (last ? formState.formErrors.length : 0) +
    (formState.stepError !== null ? 1 : 0)
);

/** The host painter of a custom field: by name, then by kind, then the `field` snippet. */
function customOf(field: FormField): SchemaFormCustomSnippet | SchemaFormCustomEntry | undefined {
  if (field.type !== 'custom') return undefined;
  const entries = customFields ?? {};
  const entry = Object.hasOwn(entries, field.name)
    ? entries[field.name]
    : field.kind !== undefined && Object.hasOwn(entries, field.kind)
      ? entries[field.kind]
      : undefined;
  // An entry that only validates is painted by the `field` snippet.
  if (typeof entry === 'function' || entry?.render || entry?.component) return entry;
  return fieldSnippet;
}

// The step navigation loads only for a multi-step form (G119).
let progressLoaded = $state(loadedProgress());
const Progress = $derived(controls?.progress ?? progressLoaded);
$effect(() => {
  if (!form.multiStep || Progress) return;
  void loadProgress().then(
    (component) => {
      progressLoaded = component;
    },
    () => {}
  );
});

// Load the controls this form uses up front (G119), so later steps paint at once.
$effect(() => {
  for (const { field } of form.fields) {
    if (isLazyControlType(field.type) && !controls?.[field.type])
      void loadControl(field.type).catch(() => {});
  }
});

// A submission the controller finished (from this view, an outside button,
// `requestSubmit()` or `controller.submit()`) opens the error summary or
// focuses the confirmation (G115).
$effect(() => {
  const state = formState;
  if (state.submitCount <= handledSubmit) return;
  if (state.status !== 'failed' && state.status !== 'submitted') return;
  handledSubmit = state.submitCount;
  untrack(() => {
    if (state.status === 'failed') {
      const first = form.fields.find((entry) => state.errors[entry.field.name]);
      void showProblems(first?.field.name ?? null);
    } else void confirmSubmitted();
  });
});

// Field ids live under `-field-`, so no field name (a letter, then letters,
// digits or `_`) can collide with the form's own `-title`, `-description`
// and `-summary` ids.
const controlId = (name: string) => `${base}-field-${name}`;

function focusField(name: string): void {
  const element = ref?.ownerDocument.getElementById(controlId(name));
  if (!element) return;
  const focusable =
    'input:not([type="hidden"]):not([disabled]), textarea, select, button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const target = element.matches(focusable)
    ? element
    : element.querySelector<HTMLElement>(focusable);
  (target ?? element).focus();
}

function setValue(name: string, value: unknown): void {
  controller.setValue(name, value);
  onValueChange?.(name, controller.getState().values[name], controller.getState().values);
}

function setFiles(name: string, list: File[]): void {
  files[name] = list;
  setValue(
    name,
    list.map((file) => ({ name: file.name, size: file.size, type: file.type }))
  );
}

async function showProblems(firstInvalid: string | null): Promise<void> {
  summaryOpen = true;
  await tick();
  if (summary) summary.focus();
  else if (firstInvalid) focusField(firstInvalid);
}

async function confirmSubmitted(): Promise<void> {
  summaryOpen = false;
  live = labels.submitted;
  await tick();
  done?.focus();
}

function onsubmit(event: SubmitEvent): void {
  event.preventDefault();
  void requestSubmit();
}

/**
 * Do what the submit button does (G115): on an earlier step validate it and
 * move on; on the last, validate and submit. Problems open the error summary.
 */
export async function requestSubmit(): Promise<void> {
  if (submitting) return;
  if (!last) {
    const outcome = await controller.next();
    if (!outcome.ok) {
      await showProblems(outcome.firstInvalid);
      return;
    }
    summaryOpen = false;
    const step = formState.steps[formState.step];
    live = formatMessage(labels.stepOf, {
      current: formState.step + 1,
      total: formState.steps.length,
      title: step?.title ?? '',
    });
    await tick();
    stepHeading?.focus();
    return;
  }
  // The summary or the confirmation follows from the controller's state.
  await controller.submit();
}

const actionState: SchemaFormActions = {
  get submitting() {
    return submitting;
  },
  get disabled() {
    return formDisabled;
  },
  get readOnly() {
    return formReadOnly;
  },
  get last() {
    return last;
  },
  get step() {
    return position;
  },
  get steps() {
    return steps.length;
  },
  get submitLabel() {
    return submitLabel;
  },
  back: () => onBack(),
  next: () => (last ? Promise.resolve() : requestSubmit()),
  submit: () => requestSubmit(),
};

async function onBack(): Promise<void> {
  controller.back();
  summaryOpen = false;
  const step = formState.steps[formState.step];
  live = formatMessage(labels.stepOf, {
    current: formState.step + 1,
    total: formState.steps.length,
    title: step?.title ?? '',
  });
  await tick();
  stepHeading?.focus();
}

async function onStepClick(target: number): Promise<void> {
  if (formDisabled || target < 0 || target === formState.step) return;
  const moved = await controller.goTo(target);
  if (!moved) {
    await showProblems(null);
    return;
  }
  summaryOpen = false;
  await tick();
  stepHeading?.focus();
}

function summaryLink(event: MouseEvent, name: string): void {
  event.preventDefault();
  focusField(name);
}

const draftText = $derived(
  formState.draft.status === 'saving'
    ? labels.draftSaving
    : formState.draft.status === 'saved'
      ? labels.draftSaved
      : formState.draft.status === 'error'
        ? labels.draftError
        : ''
);
</script>

<form
  bind:this={ref}
  {...rest}
  id={base}
  class={cx('tx-forms', className)}
  aria-labelledby={rest['aria-label'] ? undefined : `${base}-title`}
  aria-describedby={form.schema.description ? `${base}-description` : undefined}
  aria-busy={submitting || undefined}
  data-status={formState.status}
  novalidate
  {onsubmit}
>
  <svelte:element
    this={`h${level}`}
    class={cx('tx-forms__title', hideTitle && 'tx-forms__visually-hidden')}
    id={`${base}-title`}
  >{title}</svelte:element>
  {#if form.schema.description}
    <p class="tx-forms__description" id={`${base}-description`}>{form.schema.description}</p>
  {/if}

  {#if form.multiStep && steps.length > 1}
    {#if Progress}
      <Progress
        steps={steps.map((step) => ({ id: step.id, label: step.title }))}
        current={position}
        label={formatMessage(labels.progress, { title })}
        onStepClick={formDisabled ? undefined : (index: number) => void onStepClick(index)}
      />
    {:else}
      <div class="tx-forms__progress-loading" aria-hidden="true"></div>
    {/if}
  {/if}

  <p class="tx-forms__visually-hidden" role="status" aria-live="polite">{live}</p>

  {#if summaryOpen && problems > 0}
    <div class="tx-forms__summary" tabindex="-1" bind:this={summary} aria-labelledby={`${base}-summary`}>
      <svelte:element this={`h${sub}`} class="tx-forms__summary-title" id={`${base}-summary`}>{labels.errorSummary}</svelte:element>
      <p>{problems === 1 ? labels.errorCountOne : formatMessage(labels.errorCount, { count: problems })}</p>
      <ul class="tx-forms__summary-list">
        {#each stepErrors as entry (entry.name)}
          <li><a href={`#${controlId(entry.name)}`} onclick={(event) => summaryLink(event, entry.name)}>{entry.label}: {entry.message}</a></li>
        {/each}
        {#if last}
          {#each formState.formErrors as message, index (index)}
            <li>{message}</li>
          {/each}
        {/if}
        {#if formState.stepError !== null}
          <li>{formState.stepError}</li>
        {/if}
      </ul>
    </div>
  {/if}

  {#if formState.status === 'submitted'}
    <p class="tx-forms__done" tabindex="-1" bind:this={done}>{labels.submitted}</p>
  {/if}

  <div class="tx-forms__step" bind:this={panel} data-step={current?.id}>
    {#if form.multiStep}
      <svelte:element this={`h${sub}`} class="tx-forms__step-title" tabindex="-1" bind:this={stepHeading}>{current?.title}</svelte:element>
      {#if current?.description}<p class="tx-forms__step-description">{current.description}</p>{/if}
    {/if}

    {#snippet fieldView(name: string)}
      {@const entry = form.byName.get(name)}
      {@const fieldState = formState.logic.fields[name]}
      {#if entry && fieldState?.visible}
        <FormFieldControl
          field={entry.field}
          value={formState.values[name]}
          fieldState={fieldState}
          error={formState.errors[name]}
          pending={formState.pending[name] === true}
          controlId={controlId(name)}
          {labels}
          files={files[name] ?? []}
          {formDisabled}
          readOnly={formReadOnly}
          {controls}
          custom={customOf(entry.field)}
          onValue={(value) => setValue(name, value)}
          onBlur={() => void controller.blur(name)}
          onFiles={(list) => setFiles(name, list)}
        />
      {/if}
    {/snippet}

    {#if compiledStep && compiledStep.sections.length > 0}
      {#each compiledStep.sections as sectionIndex (sectionIndex)}
        {@const section = form.sections[sectionIndex]}
        {#if section && formState.logic.sections[sectionIndex]}
          {#if section.title}
            <fieldset class="tx-forms__section" data-section={section.id}>
              <legend class="tx-forms__section-title">{section.title}</legend>
              {#if section.description}<p class="tx-forms__section-description">{section.description}</p>{/if}
              {#each section.fields as name (name)}{@render fieldView(name)}{/each}
            </fieldset>
          {:else}
            <div class="tx-forms__section" data-section={section.id}>
              {#if section.description}<p class="tx-forms__section-description">{section.description}</p>{/if}
              {#each section.fields as name (name)}{@render fieldView(name)}{/each}
            </div>
          {/if}
        {/if}
      {/each}
    {:else if compiledStep}
      {#each compiledStep.fields as name (name)}{@render fieldView(name)}{/each}
    {/if}
  </div>

  {#if actions === false}
    {#if draftText}<p class="tx-forms__draft" data-draft={formState.draft.status}>{draftText}</p>{/if}
  {:else}
    <div class="tx-forms__actions">
      {#if actions}
        {@render actions(actionState)}
      {:else}
        {#if position > 0}
          <Button type="button" variant="outline" onclick={() => void onBack()} disabled={submitting || formDisabled}>{labels.back}</Button>
        {/if}
        {#if last}
          <Button
            type="submit"
            loading={formState.status === 'submitting'}
            loadingLabel={labels.submitting}
            disabled={submitting || formDisabled || formReadOnly}
          >
            {submitLabel}
          </Button>
        {:else}
          <Button
            type="submit"
            loading={formState.status === 'validating'}
            loadingLabel={labels.checking}
            disabled={submitting || formDisabled}
          >{labels.next}</Button>
        {/if}
      {/if}
      {#if draftText}<p class="tx-forms__draft" data-draft={formState.draft.status}>{draftText}</p>{/if}
    </div>
  {/if}
</form>
