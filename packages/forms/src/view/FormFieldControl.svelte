<script lang="ts">
import type { Snippet } from 'svelte';
import { Button } from 'texuli/button';
import { Checkbox, Switch } from 'texuli/choice';
import { Description, Field, FieldError } from 'texuli/field';
import { Input, Textarea } from 'texuli/input';
import { Select } from 'texuli/select';
import type { FormField, FormValue } from '../model/types.ts';
import type { FormFieldState } from '../model/validate.ts';
import { loadControl, loadedControl } from './controls/lazy.ts';
import {
  isLazyControlType,
  type SchemaFormControl,
  type SchemaFormControls,
} from './controls/types.ts';
import type {
  SchemaFormCustomEntry,
  SchemaFormCustomField,
  SchemaFormCustomSnippet,
  SchemaFormLabels,
} from './labels.ts';

/*
 * One schema field, painted with the texuli control for its type. Text-like
 * controls sit in a texuli Field (label, description and error wired to
 * the control by the Field rule); choice groups are a fieldset with a
 * legend; checkbox and switch carry their own label. Errors render as
 * texuli FieldError (`role="alert"`), linked by `aria-describedby`.
 * Every control takes the Field's props: texuli turns `aria-required` into
 * native `required` on the date and time segments and the slider input.
 *
 * Date, time, datetime, slider, tags, file, color and radio controls load
 * per type on first use (G119); until then a placeholder of about the same
 * size holds their place. `controls` paints them at once (SSR).
 */

interface Props {
  field: FormField;
  value: FormValue | undefined;
  fieldState: FormFieldState;
  error: string | undefined;
  pending: boolean;
  /** The id of the focusable control (or the group). */
  controlId: string;
  labels: SchemaFormLabels;
  files: readonly File[];
  /** The whole form is disabled or read-only (G116). */
  formDisabled: boolean;
  readOnly: boolean;
  controls: SchemaFormControls | undefined;
  /** The host painter of a custom field, if any (G113). */
  custom: SchemaFormCustomSnippet | SchemaFormCustomEntry | undefined;
  onValue: (value: unknown) => void;
  onBlur: () => void;
  onFiles: (files: File[]) => void;
}

let {
  field,
  value,
  fieldState,
  error,
  pending,
  controlId,
  labels,
  files,
  formDisabled,
  readOnly,
  controls,
  custom,
  onValue,
  onBlur,
  onFiles,
}: Props = $props();

const errorId = $derived(`${controlId}-error`);
const descriptionId = $derived(`${controlId}-description`);
const statusId = $derived(`${controlId}-status`);
const disabled = $derived(!fieldState.enabled || formDisabled);
/** Controls with no native read-only state are disabled while the form is read-only. */
const locked = $derived(disabled || readOnly);
const text = $derived(typeof value === 'string' ? value : '');
const list = $derived(Array.isArray(value) ? (value as readonly unknown[]) : []);
const strings = $derived(list.filter((item): item is string => typeof item === 'string'));
const describedBy = $derived(
  [field.description ? descriptionId : '', error ? errorId : '', pending ? statusId : '']
    .filter(Boolean)
    .join(' ') || undefined
);
const textLike = $derived(
  field.type === 'text' ||
    field.type === 'textarea' ||
    field.type === 'email' ||
    field.type === 'url' ||
    field.type === 'number' ||
    field.type === 'password' ||
    field.type === 'otp' ||
    field.type === 'custom'
);

// Per-type controls: a host registry wins, then a loaded chunk.
const lazyType = $derived(isLazyControlType(field.type) ? field.type : null);
let loaded = $state<{ type: string; control: SchemaFormControl } | null>(null);
const Control = $derived.by((): SchemaFormControl | undefined => {
  if (!lazyType) return undefined;
  const given = controls?.[lazyType];
  if (given) return given;
  if (loaded?.type === lazyType) return loaded.control;
  return loadedControl(lazyType);
});
$effect(() => {
  const type = lazyType;
  if (!type || Control) return;
  let live = true;
  void loadControl(type).then(
    (control) => {
      if (live) loaded = { type, control };
    },
    () => {}
  );
  return () => {
    live = false;
  };
});

let revealed = $state(false);
const showNone = $derived(field.type === 'select' && (field.clearable ?? !fieldState.required));

function numberFrom(event: Event): number | null {
  const raw = (event.currentTarget as HTMLInputElement).value.trim();
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toggleChoice(option: string, checked: boolean): void {
  const next = checked
    ? [...strings.filter((item) => item !== option), option]
    : strings.filter((item) => item !== option);
  onValue(field.options?.map((o) => o.value).filter((v) => next.includes(v)) ?? next);
}

function blurOutside(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null;
  if (next && (event.currentTarget as HTMLElement).contains(next)) return;
  onBlur();
}

/** The custom painter's snippet or component. */
const paint = $derived.by(
  (): {
    snippet?: Snippet<[SchemaFormCustomField]>;
    component?: SchemaFormCustomEntry['component'];
  } => {
    if (!custom) return {};
    if (typeof custom === 'function') return { snippet: custom };
    return custom.render ? { snippet: custom.render } : { component: custom.component };
  }
);

function customContext(control: {
  props: Record<string, unknown>;
  describedBy: string | undefined;
}): SchemaFormCustomField {
  const labelId = `${controlId}-label`;
  return {
    field,
    name: field.name,
    kind: field.kind ?? '',
    config: field.config ?? {},
    value,
    setValue: onValue,
    blur: onBlur,
    error,
    invalid: Boolean(error),
    required: fieldState.required,
    disabled,
    readOnly,
    pending,
    id: controlId,
    labelId,
    describedBy: control.describedBy,
    props: {
      id: controlId,
      'aria-labelledby': labelId,
      'aria-describedby': control.props['aria-describedby'] as string | undefined,
      'aria-invalid': error ? true : undefined,
      'aria-required': fieldState.required ? true : undefined,
      disabled: disabled ? true : undefined,
    },
    labels,
  };
}
</script>

{#snippet extras()}
  {#if pending}
    <p class="tx-forms__pending" id={statusId}>{labels.checking}</p>
  {/if}
  {#if field.link}
    <p class="tx-forms__link"><a href={field.link.href} rel="noopener noreferrer">{field.link.label}</a></p>
  {/if}
{/snippet}

{#snippet placeholder(id: string | undefined, rows: number)}
  <div
    class="tx-forms__control-loading"
    id={id}
    data-type={field.type}
    style={`--tx-forms-loading-rows: ${rows}`}
    aria-busy="true"
  >
    <span class="tx-forms__visually-hidden">{labels.loading}</span>
  </div>
{/snippet}

{#if field.type === 'checkbox' || field.type === 'switch'}
  <div class="tx-forms__field tx-forms__field--toggle" data-tx-forms-field={field.name} data-type={field.type}>
    {#if field.type === 'checkbox'}
      <Checkbox
        id={controlId}
        label={field.label}
        description={field.description}
        checked={value === true}
        required={fieldState.required}
        disabled={locked}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onCheckedChange={(checked) => onValue(checked)}
      />
    {:else}
      <Switch
        id={controlId}
        label={field.label}
        description={field.description}
        checked={value === true}
        required={fieldState.required}
        disabled={locked}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onCheckedChange={(checked) => onValue(checked)}
      />
    {/if}
    {@render extras()}
    <FieldError id={errorId} show={Boolean(error)}>{error}</FieldError>
  </div>
{:else if field.type === 'radio' || field.type === 'multiselect'}
  <fieldset
    class="tx-forms__field tx-forms__group"
    data-tx-forms-field={field.name}
    data-type={field.type}
    data-invalid={error ? '' : undefined}
    aria-describedby={describedBy}
    disabled={locked}
  >
    <legend class="tx-forms__legend">
      {field.label}{#if fieldState.required}<span class="tx-forms__required" aria-hidden="true"> *</span>{/if}
    </legend>
    {#if field.description}<Description id={descriptionId}>{field.description}</Description>{/if}
    {#if field.type === 'radio'}
      {#if Control}
        <Control
          {field}
          {value}
          attrs={{
            id: controlId,
            'aria-invalid': error ? 'true' : undefined,
            'aria-describedby': describedBy,
          }}
          required={fieldState.required}
          {disabled}
          {readOnly}
          {labels}
          {files}
          {onValue}
          {onFiles}
        />
      {:else}
        {@render placeholder(controlId, field.options?.length ?? 1)}
      {/if}
    {:else}
      <div class="tx-forms__choices" id={controlId}>
        {#each field.options ?? [] as option, index (option.value)}
          <Checkbox
            id={index === 0 ? `${controlId}-first` : undefined}
            label={option.label}
            description={option.description}
            checked={strings.includes(option.value)}
            disabled={locked}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? errorId : undefined}
            onCheckedChange={(checked) => toggleChoice(option.value, checked)}
          />
        {/each}
      </div>
    {/if}
    {@render extras()}
    <FieldError id={errorId} show={Boolean(error)}>{error}</FieldError>
  </fieldset>
{:else}
  <Field
    class="tx-forms__field"
    data-tx-forms-field={field.name}
    data-type={field.type}
    id={controlId}
    label={field.label}
    description={field.description}
    error={error ?? null}
    required={fieldState.required}
    {disabled}
    onfocusout={textLike ? blurOutside : undefined}
  >
    {#snippet children(control)}
      {@const props = {
        ...control.props,
        'aria-describedby': [control.describedBy, pending ? statusId : ''].filter(Boolean).join(' ') || undefined,
      }}
      {#if field.type === 'textarea'}
        <Textarea
          {...props}
          name={field.name}
          value={text}
          rows={field.rows ?? 4}
          required={fieldState.required}
          readonly={readOnly}
          placeholder={field.placeholder}
          maxlength={field.maxLength}
          oninput={(event) => onValue((event.currentTarget as HTMLTextAreaElement).value)}
        />
      {:else if field.type === 'text' || field.type === 'email' || field.type === 'url'}
        <Input
          {...props}
          type={field.type === 'text' ? 'text' : field.type}
          name={field.name}
          value={text}
          required={fieldState.required}
          readonly={readOnly}
          placeholder={field.placeholder}
          autocomplete={field.autocomplete}
          inputmode={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : undefined}
          oninput={(event) => onValue((event.currentTarget as HTMLInputElement).value)}
        />
      {:else if field.type === 'password'}
        <div class="tx-forms__password">
          <Input
            {...props}
            type={revealed ? 'text' : 'password'}
            name={field.name}
            value={text}
            required={fieldState.required}
            readonly={readOnly}
            placeholder={field.placeholder}
            autocomplete={field.autocomplete ?? 'current-password'}
            autocapitalize="off"
            spellcheck={false}
            oninput={(event) => onValue((event.currentTarget as HTMLInputElement).value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="tx-forms__reveal"
            aria-pressed={revealed}
            aria-controls={controlId}
            {disabled}
            onclick={() => (revealed = !revealed)}
          >
            {labels.showPassword}
          </Button>
        </div>
      {:else if field.type === 'otp'}
        <Input
          {...props}
          class="tx-forms__otp"
          type="text"
          name={field.name}
          value={text}
          required={fieldState.required}
          readonly={readOnly}
          placeholder={field.placeholder}
          autocomplete="one-time-code"
          inputmode="numeric"
          maxlength={field.length ?? 6}
          size={field.length ?? 6}
          style={`--tx-forms-otp-length: ${field.length ?? 6}`}
          oninput={(event) =>
            onValue((event.currentTarget as HTMLInputElement).value.replace(/\s+/g, ''))}
        />
      {:else if field.type === 'number'}
        <Input
          {...props}
          type="number"
          name={field.name}
          value={typeof value === 'number' ? value : null}
          required={fieldState.required}
          readonly={readOnly}
          placeholder={field.placeholder}
          min={typeof field.min === 'number' ? field.min : undefined}
          max={typeof field.max === 'number' ? field.max : undefined}
          step={field.step ?? 'any'}
          oninput={(event) => onValue(numberFrom(event))}
        />
      {:else if field.type === 'select'}
        <Select.Root
          name={field.name}
          value={typeof value === 'string' ? value : ''}
          items={showNone
            ? [{ value: '', label: labels.selectNone }, ...(field.options ?? [])]
            : (field.options ?? [])}
          required={fieldState.required}
          disabled={locked}
          onValueChange={(next) => onValue(next === '' ? null : next)}
        >
          <Select.Trigger {...props} disabled={locked || undefined}>
            <Select.Value placeholder={field.placeholder ?? labels.selectPlaceholder}>
              {#snippet children({ value: chosen, label })}
                {chosen ? label : (field.placeholder ?? labels.selectPlaceholder)}
              {/snippet}
            </Select.Value>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content>
              <Select.Viewport>
                {#if showNone}
                  <Select.Item value="" label={labels.selectNone}>{labels.selectNone}</Select.Item>
                {/if}
                {#each field.options ?? [] as option (option.value)}
                  <Select.Item value={option.value} label={option.label} description={option.description}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      {:else if field.type === 'custom'}
        {#if paint.snippet}
          {@render paint.snippet(customContext(control))}
        {:else if paint.component}
          <paint.component field={customContext(control)} />
        {:else}
          <p class="tx-forms__custom-missing" id={controlId} tabindex="-1">{labels.customMissing}</p>
        {/if}
      {:else if Control}
        <Control
          {field}
          {value}
          attrs={props}
          required={fieldState.required}
          {disabled}
          {readOnly}
          {labels}
          {files}
          {onValue}
          {onFiles}
        />
      {:else}
        {@render placeholder(controlId, 1)}
      {/if}
    {/snippet}
  </Field>
  {@render extras()}
{/if}
