<script lang="ts">
import { type CalendarDate, Calendar as Primitive } from '@texuli/primitives/calendar';
import { toCalendarDate } from '@texuli/primitives/date-picker';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type DateSize, dateCalendarClass } from './variants.ts';
import './date.css';

/**
 * A styled calendar on the owned APG Calendar: a heading with previous and
 * next buttons, and the day grid. The value is a `YYYY-MM-DD` string.
 */
interface Props {
  /** `bind:value`: the selected day as `YYYY-MM-DD`, or `null`. */
  value?: string | null;
  onValueChange?: (value: string) => void;
  locale?: string;
  minValue?: string;
  maxValue?: string;
  isDateUnavailable?: (date: CalendarDate) => boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: DateSize;
  previousLabel?: string;
  nextLabel?: string;
  /** Accessible name of the calendar region. */
  label?: string;
  class?: ClassValue;
}

let {
  value = $bindable(null),
  onValueChange,
  locale = 'en-US',
  minValue,
  maxValue,
  isDateUnavailable,
  disabled = false,
  readOnly = false,
  size = 'md',
  previousLabel = 'Previous month',
  nextLabel = 'Next month',
  label,
  class: className,
}: Props = $props();

const selected = $derived(toCalendarDate(value));
const min = $derived(toCalendarDate(minValue));
const max = $derived(toCalendarDate(maxValue));
</script>

<Primitive.Root
  class={dateCalendarClass({ size, class: cx(className) })}
  role="group"
  aria-label={label}
  value={selected}
  {...selected ? { defaultFocusedValue: selected } : {}}
  {locale}
  {...min ? { minValue: min } : {}}
  {...max ? { maxValue: max } : {}}
  {...isDateUnavailable ? { isDateUnavailable } : {}}
  {disabled}
  {readOnly}
  {previousLabel}
  {nextLabel}
  onValueChange={(date) => {
    value = date.toString();
    onValueChange?.(value);
  }}
>
  <div class="tx-date-calendar__header">
    <Primitive.PrevButton class="tx-date-calendar__nav"><span aria-hidden="true">‹</span></Primitive.PrevButton>
    <Primitive.Heading class="tx-date-calendar__heading" />
    <Primitive.NextButton class="tx-date-calendar__nav"><span aria-hidden="true">›</span></Primitive.NextButton>
  </div>
  <Primitive.Grid class="tx-date-calendar__grid" />
</Primitive.Root>
