<script lang="ts">
import type { CalendarDate } from '@texuli/primitives/calendar';
import { type DateInvalidHandler, DatePicker as Primitive } from '@texuli/primitives/date-picker';
import { type ClassValue, cx } from '../../internal/cx.ts';
import CalendarIcon from './CalendarIcon.svelte';
import type { DateLabels } from './labels.ts';
import { type DateSize, dateFieldClass } from './variants.ts';
import './date.css';

/**
 * A styled date picker: a segmented date field, a calendar button and a
 * calendar dialog (the owned APG DatePicker). The value is `YYYY-MM-DD`.
 */
interface Props {
  /** The field's label (visible). */
  label: string;
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

let {
  label,
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
}: Props = $props();

const uid = $props.id();
const descriptionId = `${uid}-description`;
const errorId = `${uid}-error`;
const describedBy = $derived(
  [description ? descriptionId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
);
</script>

<div
  class={dateFieldClass({ size, class: cx(className) })}
  data-tx-date
  data-invalid={error ? 'true' : undefined}
  data-disabled={disabled ? 'true' : undefined}
>
  <span class="tx-date__label" aria-hidden="true">{label}{#if required}<span class="tx-date__required"> *</span>{/if}</span>
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
        class="tx-date__field"
        {label}
        {...name ? { name } : {}}
        {required}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
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
