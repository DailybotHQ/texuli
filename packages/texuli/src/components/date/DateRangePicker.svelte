<script lang="ts">
import type { CalendarDate } from '@texuli/primitives/calendar';
import {
  type DateInvalidHandler,
  type DateRange,
  DateRangePicker as Primitive,
  rangeDays,
  rangeLimit,
} from '@texuli/primitives/date-picker';
import type { HTMLAttributes } from 'svelte/elements';
import { joinIds, splitControlProps } from '../../internal/control-props.ts';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { getFieldLabelContext } from '../field/context.ts';
import CalendarIcon from './CalendarIcon.svelte';
import type { DateLabels } from './labels.ts';
import { type DateRangePreset, dateRangePresets, matchingPreset } from './presets.ts';
import { type DateSize, dateFieldClass } from './variants.ts';
import './date.css';

/**
 * A styled date range picker: start and end date fields, a calendar button,
 * and a dialog with a range calendar and optional presets (today, last 7
 * days…). Values are `YYYY-MM-DD`.
 */
interface OwnProps {
  label: string;
  /**
   * Hide the visible label (it still names the field group). Inside a Field
   * the label is always hidden: the Field label names the group instead.
   */
  hideLabel?: boolean;
  /** Id of the first segment, so `<label for>` and Field reach the focusable control. */
  id?: string;
  description?: string;
  error?: string;
  value?: DateRange;
  onValueChange?: (value: DateRange) => void;
  open?: boolean;
  locale?: string;
  minValue?: string;
  maxValue?: string;
  isDateUnavailable?: (date: CalendarDate) => boolean;
  disabled?: boolean;
  startName?: string;
  endName?: string;
  /**
   * Ready-made ranges shown beside the calendar: `true` for the built-in ones
   * (relative to `today`), a list of your own, or `false` for none.
   */
  presets?: boolean | readonly DateRangePreset[];
  /**
   * Today (`YYYY-MM-DD`): the day presets count from and the calendar marks;
   * when set, the clock is never read. Default the local day.
   */
  today?: string;
  /** First day of the week, `0` (Sunday) to `6` (Saturday); default the locale's. */
  weekStartsOn?: number;
  /** The longest range in days, both ends included; longer ranges are refused and announced. */
  maxDays?: number;
  /** Typed text that is not a real date or is out of bounds, and refused ranges (`too-long`). */
  onInvalid?: DateInvalidHandler;
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
  value = $bindable({ start: null, end: null }),
  onValueChange,
  open = $bindable(false),
  locale = 'en-US',
  minValue,
  maxValue,
  isDateUnavailable,
  disabled = false,
  startName,
  endName,
  presets = false,
  today,
  weekStartsOn,
  maxDays,
  onInvalid,
  size = 'md',
  labels,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const split = $derived(splitControlProps(rest));
const field = getFieldLabelContext();
const showLabel = $derived(!hideLabel && !field);

const uid = $props.id();
const descriptionId = `${uid}-description`;
const errorId = `${uid}-error`;
const presetsId = `${uid}-presets`;
const describedBy = $derived(
  [description ? descriptionId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
);
const presetList = $derived(
  (presets === true
    ? dateRangePresets(today, labels?.presetLabels)
    : presets === false
      ? []
      : [...presets]
  ).filter((preset) => {
    // A preset longer than maxDays would bypass the limit: it is not offered.
    const limit = rangeLimit(maxDays);
    return limit === undefined || rangeDays(preset.start, preset.end) <= limit;
  })
);
const active = $derived(matchingPreset(presetList, value.start, value.end));

function choose(preset: DateRangePreset): void {
  value = { start: preset.start, end: preset.end };
  onValueChange?.(value);
  open = false;
}
</script>

<div
  bind:this={ref}
  {...split.wrapper}
  class={dateFieldClass({ size, class: cx('tx-date--range', className) })}
  data-tx-date
  data-invalid={error ? 'true' : undefined}
  data-disabled={disabled ? 'true' : undefined}
>
  {#if showLabel}<span class="tx-date__label" aria-hidden="true">{label}</span>{/if}
  <Primitive.Root
    bind:value
    bind:open
    {locale}
    {...minValue ? { minValue } : {}}
    {...maxValue ? { maxValue } : {}}
    {...isDateUnavailable ? { isDateUnavailable } : {}}
    {...today ? { today } : {}}
    {...weekStartsOn !== undefined ? { weekStartsOn } : {}}
    {...maxDays !== undefined ? { maxDays } : {}}
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
        {...startName ? { startName } : {}}
        {...endName ? { endName } : {}}
        aria-describedby={joinIds(describedBy, split.control['aria-describedby'] as string | undefined)}
        aria-invalid={error ? 'true' : (split.control['aria-invalid'] as 'true' | undefined)}
      />
      <Primitive.Trigger class="tx-date__trigger"><CalendarIcon /></Primitive.Trigger>
    </div>
    <Primitive.Content class="tx-date__panel">
      <div class="tx-date__range-layout">
        {#if presetList.length > 0}
          <div class="tx-date__presets" role="group" aria-labelledby={presetsId}>
            <p id={presetsId} class="tx-date__presets-title">{labels?.presets ?? 'Quick ranges'}</p>
            {#each presetList as preset (preset.id)}
              <button
                type="button"
                class="tx-date__preset"
                aria-pressed={active?.id === preset.id}
                onclick={() => choose(preset)}
              >
                {preset.label}
              </button>
            {/each}
          </div>
        {/if}
        <Primitive.Calendar class="tx-date-calendar" />
      </div>
    </Primitive.Content>
  </Primitive.Root>
  {#if description}<p id={descriptionId} class="tx-date__description">{description}</p>{/if}
  {#if error}<p id={errorId} class="tx-date__error">{error}</p>{/if}
</div>
