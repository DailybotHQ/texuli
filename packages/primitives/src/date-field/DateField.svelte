<script lang="ts">
import {
  type DateSegment,
  dateSegmentLabel,
  dateSegmentOrder,
  dateSegmentSeparator,
  formatDate,
  parseDate,
} from './date.ts';
import type { DateFieldRootProps } from './types.ts';

let {
  value = $bindable(null),
  locale,
  label = 'Date',
  name,
  disabled = false,
  required = false,
  min,
  max,
  onValueChange,
  children,
  class: className,
  ...rest
}: DateFieldRootProps = $props();

const order = $derived(dateSegmentOrder(locale));
const parsed = $derived(parseDate(value));
let fields = $state({ month: '', day: '', year: '' });
let syncedValue = $state<string | null | undefined>(undefined);
$effect(() => {
  if (syncedValue !== value) {
    fields = {
      month: parsed ? String(parsed.month) : '',
      day: parsed ? String(parsed.day) : '',
      year: parsed ? String(parsed.year) : '',
    };
    syncedValue = value;
  }
});
const low = $derived(parseDate(min));
const high = $derived(parseDate(max));

function commit(segment: DateSegment, raw: string): void {
  fields = { ...fields, [segment]: raw };
  const number = raw === '' ? null : Number(raw);
  const current = { ...fields, [segment]: raw };
  const next = {
    year: segment === 'year' ? (number ?? 0) : Number(current.year) || 0,
    month: segment === 'month' ? (number ?? 0) : Number(current.month) || 0,
    day: segment === 'day' ? (number ?? 0) : Number(current.day) || 0,
  };
  const candidate = number === null || !parseDateSafe(next) ? null : formatDate(next);
  if (candidate && ((low && candidate < formatDate(low)) || (high && candidate > formatDate(high))))
    return;
  if (candidate === value) return;
  value = candidate;
  syncedValue = candidate;
  onValueChange?.(candidate);
}

function parseDateSafe(parts: { year: number; month: number; day: number }): boolean {
  try {
    formatDate(parts);
    return true;
  } catch {
    return false;
  }
}

const limits: Record<DateSegment, { min: number; max: number }> = {
  month: { min: 1, max: 12 },
  day: { min: 1, max: 31 },
  year: { min: 1, max: 9999 },
};
</script>

<div {...rest} class={className} role="group" aria-label={label} data-tx-date-field-root="">
  {#each order as segment (segment)}
    <input
      type="number"
      inputmode="numeric"
      aria-label={dateSegmentLabel(segment)}
      aria-valuemin={limits[segment].min}
      aria-valuemax={limits[segment].max}
      min={limits[segment].min}
      max={limits[segment].max}
      value={fields[segment]}
      {disabled}
      {required}
      oninput={(event) => commit(segment, event.currentTarget.value)}
    />
    {#if segment !== order.at(-1)}<span aria-hidden="true">{dateSegmentSeparator(locale, segment)}</span>{/if}
  {/each}
  {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  {#if children}{@render children()}{/if}
</div>
