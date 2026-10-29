<script lang="ts">
import { tick, untrack } from 'svelte';
import type { HTMLFormAttributes } from 'svelte/elements';
import { Button } from 'texuli/button';
import { type ClassValue, cx } from 'texuli/cx';
import { createPresenceMotion, type MotionProp } from 'texuli/motion';
import { Stepper } from 'texuli/stepper';
import {
  createFormController,
  type FormController,
  type FormDraftOptions,
  type FormState,
  type FormSubmitResult,
  type FormValidator,
} from '../model/controller.ts';
import type { CompiledForm } from '../model/schema.ts';
import type { FormValues } from '../model/types.ts';
import { DEFAULT_FORM_MESSAGES, type FormMessages, formatMessage } from '../model/validate.ts';
import FormFieldControl from './FormFieldControl.svelte';
import {
  DEFAULT_SCHEMA_FORM_LABELS,
  type SchemaFormLabels,
  type SchemaFormSubmission,
} from './labels.ts';
import '../styles.css';

interface Props extends Omit<HTMLFormAttributes, 'onsubmit' | 'class' | 'children'> {
  /** A validated form (`validateFormSchema(schema).form`). */
  form: CompiledForm;
  /** Drive the form from your own controller (it must be made for the same `form`). */
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
  ref?: HTMLElement | null;
  class?: ClassValue;
}

let {
  form,
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
  ref = $bindable(null),
  class: className,
  id,
  ...rest
}: Props = $props();

const uid = $props.id();
const base = $derived(id ?? `tx-forms-${uid}`);
const labels = $derived<SchemaFormLabels>({ ...DEFAULT_SCHEMA_FORM_LABELS, ...labelOverrides });
const files = $state<Record<string, File[]>>({});

const controller: FormController = untrack(
  () =>
    external ??
    createFormController(form, {
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

let formState = $state.raw<FormState>(controller.getState());
let live = $state('');
let summaryOpen = $state(false);
let summary = $state<HTMLElement | null>(null);
let stepHeading = $state<HTMLElement | null>(null);
let panel = $state<HTMLElement | null>(null);
let done = $state<HTMLElement | null>(null);

$effect(() => {
  const stop = controller.subscribe((next) => {
    formState = next;
  });
  formState = controller.getState();
  return () => {
    stop();
    if (!external) controller.destroy();
  };
});

$effect(() => {
  if (!drafts || !restoreDraft) return;
  void untrack(() => controller.restoreDraft()).then((restored) => {
    if (restored) live = labels.draftRestored;
  });
});

const presence = createPresenceMotion({
  motion: () => motion,
  defaults: { enter: 'fade', exit: false, layout: false, duration: 'fast' },
});
let shownStep: number | null = null;
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
const problems = $derived(stepErrors.length + (last ? formState.formErrors.length : 0));

const controlId = (name: string) => `${base}-${name}`;

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

async function onsubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
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
  const outcome = await controller.submit();
  if (!outcome.ok) {
    await showProblems(outcome.firstInvalid);
    return;
  }
  summaryOpen = false;
  live = labels.submitted;
  await tick();
  done?.focus();
}

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
  if (target < 0 || target === formState.step) return;
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
  <svelte:element this={`h${level}`} class="tx-forms__title" id={`${base}-title`}>{title}</svelte:element>
  {#if form.schema.description}
    <p class="tx-forms__description" id={`${base}-description`}>{form.schema.description}</p>
  {/if}

  {#if form.multiStep && steps.length > 1}
    <Stepper
      class="tx-forms__progress"
      steps={steps.map((step) => ({ id: step.id, label: step.title }))}
      current={position}
      label={labels.progress}
      onStepClick={(index: number) => void onStepClick(index)}
    />
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

  <div class="tx-forms__actions">
    {#if position > 0}
      <Button type="button" variant="outline" onclick={() => void onBack()} disabled={submitting}>{labels.back}</Button>
    {/if}
    {#if last}
      <Button type="submit" loading={formState.status === 'submitting'} loadingLabel={labels.submitting} disabled={submitting}>
        {form.schema.submitLabel ?? labels.submit}
      </Button>
    {:else}
      <Button type="submit" disabled={submitting}>{labels.next}</Button>
    {/if}
    {#if draftText}<p class="tx-forms__draft" data-draft={formState.draft.status}>{draftText}</p>{/if}
  </div>
</form>
