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
  labels,
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

/** The largest minute on the step grid (45 for a 15-minute step). */
const lastMinute = $derived(Math.floor(59 / step) * step);
const KEYS: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, Home: 2, End: -2 };

/**
 * APG spinbutton keys on a segment: ArrowUp/ArrowDown step (the hour by one,
 * crossing AM/PM; the minute by `minuteStep`, snapping to the step grid),
 * both wrapping; Home/End go to the first and last value. An empty segment
 * starts at its first (ArrowUp, Home) or last (ArrowDown, End) value.
 */
function spin(segment: 'hour' | 'minute', event: KeyboardEvent): void {
  const delta = KEYS[event.key];
  if (!delta || disabled || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  const up = delta > 0;
  const raw = segment === 'hour' ? displayHour : displayMinute;
  const current = Number(raw);
  // A number input's value is '' or a valid number.
  const edge = delta * delta > 1 || raw === '';
  if (segment === 'minute') {
    const next = edge
      ? up
        ? 0
        : lastMinute
      : (up ? Math.floor(current / step) + 1 : Math.ceil(current / step) - 1) * step;
    commit('minute', String(next > lastMinute ? 0 : next < 0 ? lastMinute : next));
  } else if (edge) {
    commit('hour', String(up ? (cycle === 12 ? 1 : 0) : cycle === 12 ? 12 : 23));
  } else {
    // Step the 24-hour clock, so 11 AM → 12 PM in the 12-hour cycle.
    const hour24 = (parseHour(current, period, cycle) + delta + 24) % 24;
    if (cycle === 12) period = dayPeriod(hour24);
    commit('hour', String(formatHour(hour24, cycle)));
  }
}

function isLast(segment: TimeSegment): boolean {
  return segment === order.at(-1);
}
</script>

<div {...rest} class={className} role="group" aria-label={label} data-tx-time-field-root="">
  {#each order as segment (segment)}
    {#if segment !== 'dayPeriod'}
      {@const hour = segment === 'hour'}
      {@const low = hour && cycle === 12 ? 1 : 0}
      {@const high = hour ? (cycle === 12 ? 12 : 23) : 59}
      <input type="number" inputmode="numeric" aria-label={hour ? (labels?.hour ?? 'Hour') : (labels?.minute ?? 'Minute')} aria-valuemin={low} aria-valuemax={high} min={low} max={high} step={hour ? undefined : step} value={hour ? displayHour : displayMinute} {disabled} {required} oninput={(event) => commit(segment, event.currentTarget.value)} onkeydown={(event) => spin(segment, event)} />
    {:else}
      <select aria-label={labels?.dayPeriod ?? 'AM or PM'} value={period} {disabled} {required} onchange={(event) => changePeriod(event.currentTarget.value === 'PM' ? 'PM' : 'AM')}>
        <option value="AM">AM</option><option value="PM">PM</option>
      </select>
    {/if}
    {#if !isLast(segment)}<span aria-hidden="true">{segment === 'hour' ? ':' : ' '}</span>{/if}
  {/each}
  {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  {#if children}{@render children()}{/if}
</div>
