<script lang="ts">
import { useMessages } from '../i18n/use-messages.ts';
import type { RefProp } from '../internal/ref.ts';
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
  label: labelProp,
  inputId,
  name,
  disabled = false,
  required = false,
  min,
  max,
  onValueChange,
  onInvalid,
  children,
  class: className,
  ref = $bindable(null),
  ...rest
}: DateFieldRootProps & RefProp = $props();
const msg = useMessages();
const label = $derived(labelProp ?? msg('primitives.date-field.date-field.label', 'Date'));

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
    issue = null;
  }
});
const low = $derived(parseDate(min));
const high = $derived(parseDate(max));
/** The refused complete text (`text|reason`), so each refusal reports once. */
let issue = $state<string | null>(null);

/**
 * Typed text is complete with a month, a day and a four-digit year. A
 * complete entry that is not a real date, or is out of bounds, is refused and
 * reported through `onInvalid` (once per distinct text).
 */
function check(current: { month: string; day: string; year: string }): void {
  let reason: 'invalid' | 'out-of-range' | null = null;
  if (current.month && current.day && current.year.length > 3) {
    const parts = { year: +current.year, month: +current.month, day: +current.day };
    const iso = parseDateSafe(parts) ? formatDate(parts) : null;
    if (!iso) reason = 'invalid';
    else if ((low && iso < formatDate(low)) || (high && iso > formatDate(high)))
      reason = 'out-of-range';
  }
  const text = order
    .map(
      (segment, index) =>
        current[segment] + (index < 2 ? dateSegmentSeparator(locale, segment) : '')
    )
    .join('');
  const key = reason && `${text}|${reason}`;
  if (issue === key) return;
  issue = key;
  if (reason) onInvalid?.(text, reason);
}

function commit(segment: DateSegment, raw: string): void {
  fields = { ...fields, [segment]: raw };
  const number = raw === '' ? null : Number(raw);
  const current = { ...fields, [segment]: raw };
  const next = {
    year: segment === 'year' ? (number ?? 0) : Number(current.year) || 0,
    month: segment === 'month' ? (number ?? 0) : Number(current.month) || 0,
    day: segment === 'day' ? (number ?? 0) : Number(current.day) || 0,
  };
  check(current);
  // Only a four-digit year is a year: "2" on the way to "2026" is not 0002.
  const candidate =
    number === null || current.year.length < 4 || !parseDateSafe(next) ? null : formatDate(next);
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

<div bind:this={ref}
  {...rest}
  class={className}
  role="group"
  aria-label={rest['aria-label'] ?? label}
  data-tx-date-field-root=""
>
  {#each order as segment, index (segment)}
    <input
      type="number"
      inputmode="numeric"
      aria-label={dateSegmentLabel(segment)}
      aria-valuemin={limits[segment].min}
      aria-valuemax={limits[segment].max}
      min={limits[segment].min}
      max={limits[segment].max}
      id={index === 0 ? inputId : undefined}
      value={fields[segment]}
      aria-describedby={rest['aria-describedby']}
      aria-invalid={issue ? 'true' : rest['aria-invalid']}
      {disabled}
      {required}
      oninput={(event) => commit(segment, event.currentTarget.value)}
    />
    {#if segment !== order.at(-1)}<span aria-hidden="true">{dateSegmentSeparator(locale, segment)}</span>{/if}
  {/each}
  {#if name}<input type="hidden" {name} value={value ?? ''} />{/if}
  {#if children}{@render children()}{/if}
</div>
