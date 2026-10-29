<script lang="ts">
import type { CalendarDate } from '@texuli/primitives/calendar';
import { type DateInvalidHandler, DatePicker as Primitive } from '@texuli/primitives/date-picker';
import type { HTMLAttributes } from 'svelte/elements';
import { joinIds, splitRequiredControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { getFieldLabelContext } from '../field/context.ts';
import CalendarIcon from './CalendarIcon.svelte';
import type { DateLabels } from './labels.ts';
import { type DateSize, dateFieldClass } from './variants.ts';
import './date.css';

/**
 * A styled date picker: a segmented date field, a calendar button and a
 * calendar dialog (the owned APG DatePicker). The value is `YYYY-MM-DD`.
 */
interface OwnProps {
  /** The field's label (visible). */
  label: string;
  /**
   * Hide the visible label (it still names the field group). Inside a Field
   * the label is always hidden: the Field label names the group instead.
   */
  hideLabel?: boolean;
  /** Id of the first segment, so `<label for>` and Field reach the focusable control. */
  id?: string;
  /** Help text under the field. */
  description?: string;
  /** Error text; also marks the field invalid. */
  error?: string;
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  open?: boolean;
  locale?: string;
  minValue?: string;
  maxValue?: string;
  isDateUnavailable?: (date: CalendarDate) => boolean;
  /** The day marked as today (`YYYY-MM-DD`); when set, the clock is never read. */
  today?: string;
  /** First day of the week, `0` (Sunday) to `6` (Saturday); default the locale's. */
  weekStartsOn?: number;
  /** Typed text that is not a real date (`invalid`) or is out of bounds (`out-of-range`). */
  onInvalid?: DateInvalidHandler;
  disabled?: boolean;
  required?: boolean;
  /** Submits the value with a form. */
  name?: string;
  size?: DateSize;
  labels?: DateLabels;
  class?: ClassValue;
}

/** Field attributes (`aria-*`, `data-*`, handlers) reach the field group; the rest the wrapper. */
type Props = OwnProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof OwnProps | 'children'> & {
    /** The rendered wrapper (bindable). */
    ref?: HTMLElement | null;
  };

let {
  label,
  hideLabel = false,
  id,
  description,
  error,
  value = $bindable(null),
  onValueChange,
  open = $bindable(false),
  locale = 'en-US',
  minValue,
  maxValue,
  isDateUnavailable,
  today,
  weekStartsOn,
  onInvalid,
  disabled = false,
  required = false,
  name,
  size = 'md',
  labels,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const split = $derived(splitRequiredControlProps(rest));
// `aria-required` (a Field's control props) is not allowed on a group or a
// slider thumb: it becomes native `required` on the segment or form inputs.
const isRequired = $derived(required || split.required);
const field = getFieldLabelContext();
const showLabel = $derived(!hideLabel && !field);

const uid = $props.id();
const descriptionId = `${uid}-description`;
const errorId = `${uid}-error`;
const describedBy = $derived(
  [description ? descriptionId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
);
</script>

<div
  bind:this={ref}
  {...split.wrapper}
  class={dateFieldClass({ size, class: cx(className) })}
  data-tx-date
  data-invalid={error ? 'true' : undefined}
  data-disabled={disabled ? 'true' : undefined}
>
  {#if showLabel}<span class="tx-date__label" aria-hidden="true">{label}{#if isRequired}<span class="tx-date__required"> *</span>{/if}</span>{/if}
  <Primitive.Root
    bind:value
    bind:open
    {locale}
    {...minValue ? { minValue } : {}}
    {...maxValue ? { maxValue } : {}}
    {...isDateUnavailable ? { isDateUnavailable } : {}}
    {...today ? { today } : {}}
    {...weekStartsOn !== undefined ? { weekStartsOn } : {}}
    {...onInvalid ? { onInvalid } : {}}
    {disabled}
    {...labels ? { labels } : {}}
    {...onValueChange ? { onValueChange } : {}}
  >
    <div class="tx-date__control">
      <Primitive.Field
      {...split.control}
      {...id ? { inputId: id } : {}}
      aria-labelledby={(split.control['aria-labelledby'] as string | undefined) ?? field?.labelId}
        class="tx-date__field"
        {label}
        {...name ? { name } : {}}
        required={isRequired}
        aria-describedby={joinIds(describedBy, split.control['aria-describedby'] as string | undefined)}
        aria-invalid={error ? 'true' : (split.control['aria-invalid'] as 'true' | undefined)}
      />
      <Primitive.Trigger class="tx-date__trigger"><CalendarIcon /></Primitive.Trigger>
    </div>
    <Primitive.Content class="tx-date__panel">
      <Primitive.Calendar class="tx-date-calendar" />
    </Primitive.Content>
  </Primitive.Root>
  {#if description}<p id={descriptionId} class="tx-date__description">{description}</p>{/if}
  {#if error}<p id={errorId} class="tx-date__error">{error}</p>{/if}
</div>
