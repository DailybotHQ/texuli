<script lang="ts">
import type { CalendarDate } from '@texuli/primitives/calendar';
import { type DateRange, DateRangePicker as Primitive } from '@texuli/primitives/date-picker';
import { type ClassValue, cx } from '../../internal/cx.ts';
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
interface Props {
  label: string;
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
  /** The day presets count from (`YYYY-MM-DD`); default the local day. */
  today?: string;
  size?: DateSize;
  labels?: DateLabels;
  class?: ClassValue;
}

let {
  label,
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
  size = 'md',
  labels,
  class: className,
}: Props = $props();

const uid = $props.id();
const descriptionId = `${uid}-description`;
const errorId = `${uid}-error`;
const presetsId = `${uid}-presets`;
const describedBy = $derived(
  [description ? descriptionId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined
);
const presetList = $derived(
  presets === true
    ? dateRangePresets(today, labels?.presetLabels)
    : presets === false
      ? []
      : [...presets]
);
const active = $derived(matchingPreset(presetList, value.start, value.end));

function choose(preset: DateRangePreset): void {
  value = { start: preset.start, end: preset.end };
  onValueChange?.(value);
  open = false;
}
</script>

<div
  class={dateFieldClass({ size, class: cx('tx-date--range', className) })}
  data-tx-date
  data-invalid={error ? 'true' : undefined}
  data-disabled={disabled ? 'true' : undefined}
>
  <span class="tx-date__label" aria-hidden="true">{label}</span>
  <Primitive.Root
    bind:value
    bind:open
    {locale}
    {...minValue ? { minValue } : {}}
    {...maxValue ? { maxValue } : {}}
    {...isDateUnavailable ? { isDateUnavailable } : {}}
    {disabled}
    {...labels ? { labels } : {}}
    {...onValueChange ? { onValueChange } : {}}
  >
    <div class="tx-date__control">
      <Primitive.Field
        class="tx-date__field"
        {label}
        {...startName ? { startName } : {}}
        {...endName ? { endName } : {}}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
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
