<script lang="ts">
import { TimeField as Primitive, type TimeFieldLabels } from '@texuli/primitives/date-field';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type DateSize, dateFieldClass } from './variants.ts';
import './date.css';

/**
 * A styled time field on the owned TimeField: hour and minute spinbuttons
 * (and AM/PM in the 12-hour cycle) in one labelled group. The value is a
 * 24-hour `HH:mm` string, or `null` until both hour and minute are set.
 * ArrowUp/ArrowDown spin a segment (the minute by `minuteStep`), wrapping.
 */
interface Props {
  /** The field's label (visible). */
  label: string;
  /** Help text under the field. */
  description?: string;
  /** Error text; also marks the field invalid. */
  error?: string;
  /** `bind:value`: the time as `HH:mm` (24-hour), or `null`. */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  locale?: string;
  /** `12` shows AM/PM; `24` does not. Default the locale's cycle. */
  hourCycle?: 12 | 24;
  /** Minutes moved by the arrow keys on the minute segment. Default `1`. */
  minuteStep?: number;
  disabled?: boolean;
  required?: boolean;
  /** Submits the value with a form. */
  name?: string;
  size?: DateSize;
  /** Segment names (`hour`, `minute`, `dayPeriod`), for translation. */
  labels?: Partial<TimeFieldLabels>;
  class?: ClassValue;
}

let {
  label,
  description,
  error,
  value = $bindable(null),
  onValueChange,
  locale = 'en-US',
  hourCycle,
  minuteStep = 1,
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
  class={dateFieldClass({ size, class: cx('tx-date--time', className) })}
  data-tx-time
  data-invalid={error ? 'true' : undefined}
  data-disabled={disabled ? 'true' : undefined}
>
  <span class="tx-date__label" aria-hidden="true">{label}{#if required}<span class="tx-date__required"> *</span>{/if}</span>
  <div class="tx-date__control">
    <Primitive.Root
      class="tx-date__field"
      bind:value
      {label}
      {locale}
      {...hourCycle ? { hourCycle } : {}}
      {minuteStep}
      {disabled}
      {required}
      {...name ? { name } : {}}
      {...labels ? { labels } : {}}
      {...onValueChange ? { onValueChange } : {}}
      aria-describedby={describedBy}
      aria-invalid={error ? 'true' : undefined}
    />
  </div>
  {#if description}<p id={descriptionId} class="tx-date__description">{description}</p>{/if}
  {#if error}<p id={errorId} class="tx-date__error">{error}</p>{/if}
</div>
