<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'locale',
      label: 'locale',
      options: ['en-US', 'de-DE', 'ja-JP'],
      default: 'en-US',
    },
    { kind: 'boolean', name: 'closeOnSelect', label: 'closeOnSelect', default: true },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['ArrowLeft', 'ArrowRight'], action: 'Previous or next day in the calendar' },
    { keys: ['ArrowUp', 'ArrowDown'], action: 'Same day in the previous or next week' },
    { keys: ['PageUp', 'PageDown'], action: 'Previous or next month (Shift: year)' },
    { keys: ['Home', 'End'], action: 'First or last day of the week' },
    { keys: ['Enter', ' '], action: 'Choose the focused day' },
    { keys: ['Escape'], action: 'Close the calendar, focus returns to the button' },
  ],
  uncontrolled:
    'A plain value (no binding) starts on 15 March 2026; the picker keeps its own date.',
  controlled:
    'bind:value holds the date as YYYY-MM-DD in your state; buttons outside change or clear it.',
  code: (v) => `<script lang="ts">
  import { DatePicker } from '@texuli/primitives/date-picker';
  let due = $state<string | null>('2026-03-15');
${SCRIPT_END}

<DatePicker.Root bind:value={due}${attr('locale', String(v.locale), 'en-US')}${attr('closeOnSelect', v.closeOnSelect === true, true)}${attr('disabled', v.disabled === true, false)}>
  <DatePicker.Field label="Due date" />
  <DatePicker.Trigger><CalendarIcon /></DatePicker.Trigger>
  <DatePicker.Content>
    <DatePicker.Calendar />
  </DatePicker.Content>
</DatePicker.Root>`,
  keyCheck: {
    open: '[data-demo-part="DatePicker.Trigger"]',
    focus: '[data-calendar-date="2026-03-15"]',
    press: 'ArrowRight',
    expect: { selector: '[data-calendar-date="2026-03-16"]:focus', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="clear"]',
    expect: {
      selector: '[data-demo-part="DatePicker.Trigger"]',
      attribute: 'aria-label',
      value: 'Choose date',
    },
  },
};
</script>

<script lang="ts">
import { DatePicker } from '@texuli/primitives/date-picker';
import { Button } from 'texuli/button';
import { dateFieldClass } from 'texuli/date';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const locale = $derived(str(values, 'locale', 'en-US'));
const closeOnSelect = $derived(bool(values, 'closeOnSelect', true));
const disabled = $derived(bool(values, 'disabled'));

let due = $state<string | null>('2026-03-15');
</script>

{#snippet parts(label: string)}
  <span class="tx-date__label" aria-hidden="true">{label}</span>
  <div class="tx-date__control">
    <DatePicker.Field class="tx-date__field" {label} data-demo-part="DatePicker.Field" />
    <DatePicker.Trigger class="tx-date__trigger" data-demo-part="DatePicker.Trigger">
      <svg class="tx-date__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      </svg>
    </DatePicker.Trigger>
  </div>
  <DatePicker.Content class="tx-date__panel" data-demo-part="DatePicker.Content">
    <DatePicker.Calendar class="tx-date-calendar" data-demo-part="DatePicker.Calendar" />
  </DatePicker.Content>
{/snippet}

{#if mode === 'uncontrolled'}
  <div class={dateFieldClass()} data-tx-date data-disabled={disabled ? 'true' : undefined} data-demo-part="DatePicker.Root">
    {#key locale}
      <DatePicker.Root value="2026-03-15" {locale} {closeOnSelect} {disabled}>
        {@render parts('Due date')}
      </DatePicker.Root>
    {/key}
  </div>
{:else}
  <div class={dateFieldClass()} data-tx-date data-disabled={disabled ? 'true' : undefined} data-demo-part="DatePicker.Root">
    <DatePicker.Root bind:value={due} {locale} {closeOnSelect} {disabled}>
      {@render parts('Ship date')}
    </DatePicker.Root>
  </div>
  <div class="demo-controls">
    <output data-demo-readout>value: {due ?? 'null'}</output>
    <Button size="sm" variant="outline" onclick={() => (due = '2026-04-01')} data-demo-act="april">Set 2026-04-01</Button>
    <Button size="sm" variant="ghost" onclick={() => (due = null)} data-demo-act="clear">Clear</Button>
  </div>
{/if}
