<script lang="ts">
import {
  dayPeriod,
  formatHour,
  formatTime,
  parseHour,
  parseTime,
  type TimeSegment,
  timeSegmentOrder,
} from './time.ts';
import type { TimeFieldRootProps } from './types.ts';

let {
  value = $bindable(null),
  locale,
  label = 'Time',
  name,
  disabled = false,
  required = false,
  hourCycle,
  minuteStep = 1,
  onValueChange,
  children,
  class: className,
  ...rest
}: TimeFieldRootProps = $props();

const cycle = $derived(
  hourCycle ??
    (new Intl.DateTimeFormat(locale, { hour: 'numeric' })
      .resolvedOptions()
      .hourCycle?.startsWith('h1')
      ? 12
      : 24)
);
const order = $derived(timeSegmentOrder(locale, cycle));
const parsed = $derived(parseTime(value));
let displayHour = $state('');
let displayMinute = $state('');
let period = $state<'AM' | 'PM'>('AM');
let syncedValue = $state<string | null | undefined>(undefined);
$effect(() => {
  if (syncedValue !== value) {
    displayHour = parsed ? String(formatHour(parsed.hour, cycle)) : '';
    displayMinute = parsed ? String(parsed.minute) : '';
    period = parsed ? dayPeriod(parsed.hour) : 'AM';
    syncedValue = value;
  }
});
const step = $derived(
  Number.isInteger(minuteStep) && minuteStep > 0 && minuteStep <= 60 ? minuteStep : 1
);

function commit(segment: TimeSegment, raw: string): void {
  if (segment === 'hour') displayHour = raw;
  if (segment === 'minute') displayMinute = raw;
  const input = raw === '' ? null : Number(raw);
  const hour = segment === 'hour' ? input : displayHour === '' ? null : Number(displayHour);
  const minute = segment === 'minute' ? input : displayMinute === '' ? null : Number(displayMinute);
  if (segment === 'dayPeriod') return;
  if (hour === null || minute === null) {
    if (value !== null) {
      value = null;
      onValueChange?.(null);
      syncedValue = null;
    }
    return;
  }
  if (
    (cycle === 12 && (hour < 1 || hour > 12)) ||
    (cycle === 24 && (hour < 0 || hour > 23)) ||
    minute < 0 ||
    minute > 59
  )
    return;
  const next = formatTime({ hour: parseHour(hour, period, cycle), minute });
  if (next !== value) {
    value = next;
    onValueChange?.(next);
    syncedValue = next;
  }
}

function changePeriod(next: 'AM' | 'PM'): void {
  if (!parsed || cycle !== 12) return;
  period = next;
  const valueNext = formatTime({
    hour: parseHour(Number(displayHour), next, cycle),
    minute: parsed.minute,
  });
  if (valueNext !== value) {
    value = valueNext;
    onValueChange?.(valueNext);
    syncedValue = valueNext;
  }
}

function isLast(segment: TimeSegment): boolean {
  return segment === order.at(-1);
}
</script>

<div {...rest} class={className} role="group" aria-label={label} data-tx-time-field-root="">
  {#each order as segment (segment)}
    {#if segment === 'hour'}
      <input type="number" inputmode="numeric" aria-label="Hour" aria-valuemin={cycle === 12 ? 1 : 0} aria-valuemax={cycle === 12 ? 12 : 23} min={cycle === 12 ? 1 : 0} max={cycle === 12 ? 12 : 23} value={displayHour} {disabled} {required} oninput={(event) => commit('hour', event.currentTarget.value)} />
    {:else if segment === 'minute'}
      <input type="number" inputmode="numeric" aria-label="Minute" aria-valuemin="0" aria-valuemax="59" min="0" max="59" step={step} value={displayMinute} {disabled} {required} oninput={(event) => commit('minute', event.currentTarget.value)} />
    {:else}
      <select aria-label="AM or PM" value={period} {disabled} {required} onchange={(event) => changePeriod(event.currentTarget.value === 'PM' ? 'PM' : 'AM')}>
        <option value="AM">AM</option><option value="PM">PM</option>
      </select>
    {/if}
    {#if !isLast(segment)}<span aria-hidden="true">{segment === 'hour' ? ':' : ' '}</span>{/if}
  {/each}
  {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  {#if children}{@render children()}{/if}
</div>
