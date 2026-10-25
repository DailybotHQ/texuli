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
    { kind: 'enum', name: 'hourCycle', label: 'hourCycle', options: ['12', '24'], default: '12' },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
    { kind: 'boolean', name: 'required', label: 'required', default: false },
  ],
  keys: [
    { keys: ['ArrowUp', 'ArrowDown'], action: 'Step the focused segment up or down' },
    { keys: ['Tab'], action: 'Move to the next segment (order follows the locale)' },
  ],
  uncontrolled:
    'A plain ISO value seeds each field; segments follow the locale and the field keeps what you type.',
  controlled:
    'bind:value holds ISO strings (2026-03-15, 17:05) in your state; buttons outside set them.',
  code: (v) => `<script lang="ts">
  import { DateField, TimeField } from '@texuli/primitives/date-field';
  let date = $state<string | null>('2026-03-15');
  let time = $state<string | null>('17:05');
${SCRIPT_END}

<DateField.Root bind:value={date} label="Delivery date" locale="${v.locale}" name="date"${attr('disabled', v.disabled === true, false)}${attr('required', v.required === true, false)} />
<TimeField.Root bind:value={time} label="Delivery time" locale="${v.locale}" hourCycle={${v.hourCycle === '24' ? 24 : 12}} name="time"${attr('disabled', v.disabled === true, false)}${attr('required', v.required === true, false)} />`,
  keyCheck: {
    focus: '[data-demo-part="DateField.Root"] input[aria-label="Month"]',
    press: 'ArrowUp',
    expect: {
      selector: '[data-demo-part="DateField.Root"]',
      attribute: 'data-demo-value',
      value: '2026-04-15',
    },
  },
  controlCheck: {
    act: '[data-demo-act="today"]',
    expect: {
      selector: '[data-demo-part="DateField.Root"]',
      attribute: 'data-demo-value',
      value: '2026-12-24',
    },
  },
};
</script>

<script lang="ts">
import { DateField, TimeField } from '@texuli/primitives/date-field';
import type { Snippet } from 'svelte';
import { Button } from 'texuli/button';
import { dateFieldClass } from 'texuli/date';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const locale = $derived(str(values, 'locale', 'en-US'));
const hourCycle = $derived<12 | 24>(str(values, 'hourCycle') === '24' ? 24 : 12);
const disabled = $derived(bool(values, 'disabled'));
const required = $derived(bool(values, 'required'));

// Uncontrolled: the fields own their values; onValueChange only reports them.
let seenDate = $state<string | null>('2026-03-15');
let seenTime = $state<string | null>('17:05');
// Controlled: the values live here.
let date = $state<string | null>('2026-03-15');
let time = $state<string | null>('17:05');
</script>

{#snippet frame(label: string, field: Snippet)}
  <div class={dateFieldClass({ size: 'md' })} data-tx-date="" data-disabled={disabled ? 'true' : undefined}>
    <span class="tx-date__label" aria-hidden="true">{label}{#if required}<span class="tx-date__required"> *</span>{/if}</span>
    <div class="tx-date__control">{@render field()}</div>
  </div>
{/snippet}

{#if mode === 'uncontrolled'}
  {#key `${locale}-${hourCycle}`}
    {#snippet dateField()}
      <DateField.Root class="tx-date__field" value="2026-03-15" {locale} label="Delivery date" name="date" {disabled} {required} onValueChange={(next) => (seenDate = next)} data-demo-part="DateField.Root" data-demo-value={seenDate ?? ''} />
    {/snippet}
    {#snippet timeField()}
      <TimeField.Root class="tx-date__field" value="17:05" {locale} {hourCycle} label="Delivery time" name="time" {disabled} {required} onValueChange={(next) => (seenTime = next)} data-demo-part="TimeField.Root" data-demo-value={seenTime ?? ''} />
    {/snippet}
    {@render frame('Delivery date', dateField)}
    {@render frame('Delivery time', timeField)}
  {/key}
  <p class="demo-controls"><output data-demo-readout>Reported: {seenDate ?? 'invalid'} at {seenTime ?? 'invalid'}</output></p>
{:else}
  {#key `${locale}-${hourCycle}`}
    {#snippet dateField()}
      <DateField.Root class="tx-date__field" bind:value={date} {locale} label="Pickup date" name="date" {disabled} {required} data-demo-part="DateField.Root" data-demo-value={date ?? ''} />
    {/snippet}
    {#snippet timeField()}
      <TimeField.Root class="tx-date__field" bind:value={time} {locale} {hourCycle} label="Pickup time" name="time" {disabled} {required} data-demo-part="TimeField.Root" data-demo-value={time ?? ''} />
    {/snippet}
    {@render frame('Pickup date', dateField)}
    {@render frame('Pickup time', timeField)}
  {/key}
  <div class="demo-controls">
    <output data-demo-readout>value: {date ?? 'null'} · {time ?? 'null'}</output>
    <Button size="sm" variant="outline" onclick={() => { date = '2026-12-24'; time = '09:30'; }} data-demo-act="today">Set 24 Dec, 09:30</Button>
    <Button size="sm" variant="ghost" onclick={() => { date = null; time = null; }}>Clear</Button>
  </div>
{/if}
