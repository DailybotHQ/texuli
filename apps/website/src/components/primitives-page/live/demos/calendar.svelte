<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'locale',
      label: 'locale',
      options: ['en-US', 'fr-FR', 'ja-JP'],
      default: 'en-US',
    },
    {
      kind: 'number',
      name: 'weekStartsOn',
      label: 'weekStartsOn',
      min: 0,
      max: 6,
      step: 1,
      default: 0,
    },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    {
      keys: ['ArrowLeft', 'ArrowRight'],
      action: 'Previous or next day (mirrored in right to left)',
    },
    { keys: ['ArrowUp', 'ArrowDown'], action: 'Same day in the previous or next week' },
    { keys: ['Home', 'End'], action: 'First or last day of the week' },
    { keys: ['PageUp', 'PageDown'], action: 'Previous or next month (with Shift: year)' },
    { keys: ['Enter', ' '], action: 'Select the focused day' },
  ],
  uncontrolled:
    'defaultValue selects 15 March 2026; the calendar keeps the selection. The 25th is unavailable.',
  controlled: 'bind:value holds the selected CalendarDate in your state.',
  code: (v) => `<script lang="ts">
  import { Calendar, CalendarDate } from '@texuli/primitives/calendar';
  let value = $state(new CalendarDate(2026, 3, 15));
${SCRIPT_END}

<Calendar.Root bind:value${attr('locale', v.locale ?? 'en-US', 'en-US')}${attr('weekStartsOn', v.weekStartsOn ?? 0, 0)}${attr('disabled', v.disabled === true, false)}>
  <Calendar.PrevButton>‹</Calendar.PrevButton>
  <Calendar.Heading />
  <Calendar.NextButton>›</Calendar.NextButton>
  <Calendar.Grid />
</Calendar.Root>`,
  keyCheck: {
    focus: '[data-demo-part="Calendar.Grid"] button[tabindex="0"]',
    press: 'ArrowRight',
    expect: { selector: '[data-calendar-date="2026-03-16"]:focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="first"]',
    expect: {
      selector: '[data-calendar-date="2026-03-01"]',
      attribute: 'data-selected',
      value: '',
    },
  },
};
</script>

<script lang="ts">
import { Calendar, CalendarDate } from '@texuli/primitives/calendar';
import { Button } from 'texuli/button';
import { dateCalendarClass } from 'texuli/date';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const START = new CalendarDate(2026, 3, 15);
const UNAVAILABLE = new CalendarDate(2026, 3, 25);
const isDateUnavailable = (date: CalendarDate) => date.compare(UNAVAILABLE) === 0;

const locale = $derived(str(values, 'locale', 'en-US'));
const weekStartsOn = $derived(Math.min(6, Math.max(0, Math.round(num(values, 'weekStartsOn')))));
const disabled = $derived(bool(values, 'disabled'));

let value = $state<CalendarDate | null>(START);
</script>

{#snippet parts()}
  <div class="tx-date-calendar__header">
    <Calendar.PrevButton class="tx-date-calendar__nav" data-demo-part="Calendar.PrevButton"><span aria-hidden="true">‹</span></Calendar.PrevButton>
    <Calendar.Heading class="tx-date-calendar__heading" data-demo-part="Calendar.Heading" />
    <Calendar.NextButton class="tx-date-calendar__nav" data-demo-part="Calendar.NextButton"><span aria-hidden="true">›</span></Calendar.NextButton>
  </div>
  <Calendar.Grid class="tx-date-calendar__grid" data-demo-part="Calendar.Grid" />
{/snippet}

{#if mode === 'uncontrolled'}
  {#key locale}
    <Calendar.Root
      class={dateCalendarClass({ size: 'md' })}
      role="group"
      aria-label="Delivery date"
      defaultValue={START}
      {locale}
      {weekStartsOn}
      {disabled}
      {isDateUnavailable}
      data-demo-part="Calendar.Root"
    >
      {@render parts()}
    </Calendar.Root>
  {/key}
{:else}
  {#key locale}
    <Calendar.Root
      class={dateCalendarClass({ size: 'md' })}
      role="group"
      aria-label="Pickup date"
      bind:value
      defaultFocusedValue={START}
      {locale}
      {weekStartsOn}
      {disabled}
      {isDateUnavailable}
      data-demo-part="Calendar.Root"
    >
      {@render parts()}
    </Calendar.Root>
  {/key}
  <div class="demo-controls">
    <output data-demo-readout>value: {value ? value.toString() : 'none'}</output>
    <Button size="sm" variant="outline" onclick={() => (value = new CalendarDate(2026, 3, 1))} data-demo-act="first">Pick 1 March</Button>
    <Button size="sm" variant="ghost" onclick={() => (value = START)}>Back to the 15th</Button>
  </div>
{/if}
