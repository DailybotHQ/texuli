<script lang="ts">
import { Checkbox, RadioGroup, Switch } from 'texuli/choice';
import { DatePicker, TimeField } from 'texuli/date';
import { Description, Field, FieldError } from 'texuli/field';
import { FileUpload } from 'texuli/file-upload';
import { Input, Textarea } from 'texuli/input';
import { Select } from 'texuli/select';
import { Slider } from 'texuli/slider';
import { TagsInput } from 'texuli/tags-color';
import type { FormField, FormValue } from '../model/types.ts';
import type { FormFieldState } from '../model/validate.ts';
import type { SchemaFormLabels } from './labels.ts';

/*
 * One schema field, painted with the texuli control for its type. Text-like
 * controls sit in a texuli Field (label, description and error wired to
 * the control by the Field rule); choice groups are a fieldset with a
 * legend; checkbox and switch carry their own label. Errors render as
 * texuli FieldError (`role="alert"`), linked by `aria-describedby`.
 * Every control takes the Field's props: texuli turns `aria-required` into
 * native `required` on the date and time segments and the slider input.
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
  onValue,
  onBlur,
  onFiles,
}: Props = $props();

const errorId = $derived(`${controlId}-error`);
const descriptionId = $derived(`${controlId}-description`);
const statusId = $derived(`${controlId}-status`);
const disabled = $derived(!fieldState.enabled);
const text = $derived(typeof value === 'string' ? value : '');
const list = $derived(Array.isArray(value) ? (value as readonly unknown[]) : []);
const strings = $derived(list.filter((item): item is string => typeof item === 'string'));
const describedBy = $derived(
  [field.description ? descriptionId : '', error ? errorId : '', pending ? statusId : '']
    .filter(Boolean)
    .join(' ') || undefined
);

function inputType(): 'text' | 'email' | 'url' | 'number' {
  if (field.type === 'email' || field.type === 'url' || field.type === 'number') return field.type;
  return 'text';
}

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

function addFiles(added: File[]): void {
  const all = field.maxItems === 1 ? added.slice(-1) : [...files, ...added];
  onFiles(all);
}

function removeFile(file: File): void {
  onFiles(files.filter((item) => item !== file));
}

function blurOutside(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null;
  if (next && (event.currentTarget as HTMLElement).contains(next)) return;
  onBlur();
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

{#if field.type === 'checkbox' || field.type === 'switch'}
  <div class="tx-forms__field tx-forms__field--toggle" data-tx-forms-field={field.name} data-type={field.type}>
    {#if field.type === 'checkbox'}
      <Checkbox
        id={controlId}
        label={field.label}
        description={field.description}
        checked={value === true}
        required={fieldState.required}
        {disabled}
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
        {disabled}
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
    {disabled}
  >
    <legend class="tx-forms__legend">
      {field.label}{#if fieldState.required}<span class="tx-forms__required" aria-hidden="true"> *</span>{/if}
    </legend>
    {#if field.description}<Description id={descriptionId}>{field.description}</Description>{/if}
    {#if field.type === 'radio'}
      <RadioGroup
        id={controlId}
        name={field.name}
        value={typeof value === 'string' ? value : ''}
        items={field.options ?? []}
        required={fieldState.required}
        {disabled}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        onValueChange={(next) => onValue(next)}
      />
    {:else}
      <div class="tx-forms__choices" id={controlId}>
        {#each field.options ?? [] as option, index (option.value)}
          <Checkbox
            id={index === 0 ? `${controlId}-first` : undefined}
            label={option.label}
            description={option.description}
            checked={strings.includes(option.value)}
            {disabled}
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
    onfocusout={field.type === 'text' || field.type === 'textarea' || field.type === 'email' || field.type === 'url' || field.type === 'number'
      ? blurOutside
      : undefined}
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
          placeholder={field.placeholder}
          maxlength={field.maxLength}
          oninput={(event) => onValue((event.currentTarget as HTMLTextAreaElement).value)}
        />
      {:else if field.type === 'text' || field.type === 'email' || field.type === 'url'}
        <Input
          {...props}
          type={inputType()}
          name={field.name}
          value={text}
          required={fieldState.required}
          placeholder={field.placeholder}
          autocomplete={field.autocomplete}
          inputmode={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : undefined}
          oninput={(event) => onValue((event.currentTarget as HTMLInputElement).value)}
        />
      {:else if field.type === 'number'}
        <Input
          {...props}
          type="number"
          name={field.name}
          value={typeof value === 'number' ? value : null}
          required={fieldState.required}
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
          items={field.options ?? []}
          required={fieldState.required}
          {disabled}
          onValueChange={(next) => onValue(next === '' ? null : next)}
        >
          <Select.Trigger {...props}>
            <Select.Value placeholder={field.placeholder ?? labels.selectPlaceholder} />
          </Select.Trigger>
          <Select.Portal>
            <Select.Content>
              <Select.Viewport>
                {#each field.options ?? [] as option (option.value)}
                  <Select.Item value={option.value} label={option.label} description={option.description}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      {:else if field.type === 'date'}
        <DatePicker
          {...props}
          label={field.label}
          name={field.name}
          value={typeof value === 'string' ? value : null}
          minValue={typeof field.min === 'string' ? field.min : undefined}
          maxValue={typeof field.max === 'string' ? field.max : undefined}
          required={fieldState.required}
          onValueChange={(next) => onValue(next)}
        />
      {:else if field.type === 'time'}
        <TimeField
          {...props}
          label={field.label}
          name={field.name}
          value={typeof value === 'string' ? value : null}
          required={fieldState.required}
          onValueChange={(next) => onValue(next)}
        />
      {:else if field.type === 'slider'}
        <Slider
          {...props}
          name={field.name}
          value={typeof value === 'number' ? value : typeof field.min === 'number' ? field.min : 0}
          min={typeof field.min === 'number' ? field.min : 0}
          max={typeof field.max === 'number' ? field.max : 100}
          step={field.step ?? 1}
          thumbLabel={field.label}
          showValue
          onValueChange={(next) => onValue(Array.isArray(next) ? next[0] : next)}
        />
      {:else if field.type === 'tags'}
        <TagsInput
          {...props}
          name={field.name}
          value={[...strings]}
          max={field.maxItems}
          required={fieldState.required}
          placeholder={field.placeholder}
          inputLabel={labels.tagsInput}
          onValueChange={(next) => onValue(next)}
        />
      {:else if field.type === 'file'}
        <FileUpload
          {...props}
          name={field.name}
          files={[...files]}
          accept={field.accept?.join(',')}
          maxSize={field.maxSize}
          maxFiles={field.maxItems}
          multiple={field.maxItems !== 1}
          required={fieldState.required}
          onFilesAdd={addFiles}
          onFileRemove={removeFile}
        />
      {/if}
    {/snippet}
  </Field>
  {@render extras()}
{/if}
