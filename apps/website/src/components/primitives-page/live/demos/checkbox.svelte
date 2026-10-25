<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md'], default: 'md' },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
    { kind: 'boolean', name: 'required', label: 'required', default: false },
  ],
  keys: [
    { keys: [' '], action: 'Toggle the focused checkbox' },
    { keys: ['Tab'], action: 'Move to the next checkbox (each is its own stop)' },
  ],
  uncontrolled:
    'defaultChecked and a Group with defaultValue: each box keeps its own state, and the group submits its values by name.',
  controlled:
    'bind:value on the Group plus a "Select all" box whose checked and indeterminate come from your state.',
  code: (v) => `<script lang="ts">
  import { Checkbox } from '@texuli/primitives/checkbox';
  let channels = $state(['email']);
${SCRIPT_END}

<Checkbox.Group bind:value={channels} name="channels"${attr('disabled', v.disabled === true, false)}${attr('required', v.required === true, false)}>
  <Checkbox.Root value="email" id="email">
    {#snippet children({ checked })}
      <Checkbox.Indicator visible={checked}>✓</Checkbox.Indicator>
    {/snippet}
  </Checkbox.Root>
  <label for="email">Email</label>
  <!-- …sms, push -->
</Checkbox.Group>

${recipeLine('choiceControlClass', 'texuli/choice', { size: v.size ?? 'md' })}`,
  keyCheck: {
    focus: '[data-demo-item="updates"]',
    press: ' ',
    expect: { selector: '[data-demo-item="updates"]', attribute: 'aria-checked', value: 'true' },
  },
  controlCheck: {
    act: '[data-demo-act="all"]',
    expect: { selector: '[data-demo-item="all"]', attribute: 'aria-checked', value: 'true' },
  },
};
</script>

<script lang="ts">
import { Checkbox } from '@texuli/primitives/checkbox';
import { Button } from 'texuli/button';
import { type ChoiceSize, choiceControlClass, radioGroupClass } from 'texuli/choice';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const uid = $props.id();
const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text message' },
  { value: 'push', label: 'Push notification' },
];
const ALL = CHANNELS.map((channel) => channel.value);

const size = $derived<ChoiceSize>(str(values, 'size', 'md') === 'sm' ? 'sm' : 'md');
const disabled = $derived(bool(values, 'disabled'));
const required = $derived(bool(values, 'required'));
const controlClass = $derived(choiceControlClass({ size }));
// Texuli's choice-group layout (stacked rows with room between targets).
const groupClass = radioGroupClass({ orientation: 'vertical' });

let channels = $state<string[]>(['email']);
const all = $derived(channels.length === ALL.length);
const some = $derived(channels.length > 0 && !all);
</script>

{#snippet indicator(checked: boolean, indeterminate: boolean)}
  <Checkbox.Indicator visible={checked || indeterminate} data-demo-part="Checkbox.Indicator">
    {#if indeterminate}
      <svg class="tx-choice-control__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 8h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      </svg>
    {:else}
      <svg class="tx-choice-control__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </Checkbox.Indicator>
{/snippet}

{#snippet channelList()}
  {#each CHANNELS as channel (channel.value)}
    <div class="tx-choice" data-tx-choice-field="checkbox">
      <span class="tx-choice__hit">
        <Checkbox.Root id="{uid}-{channel.value}" value={channel.value} class={controlClass} data-tx-choice="checkbox" data-demo-part="Checkbox.Root" data-demo-item={channel.value}>
          {#snippet children({ checked, indeterminate })}
            {@render indicator(checked, indeterminate)}
          {/snippet}
        </Checkbox.Root>
      </span>
      <div class="tx-choice__copy">
        <label class="tx-choice__label" for="{uid}-{channel.value}">{channel.label}</label>
      </div>
    </div>
  {/each}
{/snippet}

{#if mode === 'uncontrolled'}
  <div class="tx-choice" data-tx-choice-field="checkbox">
    <span class="tx-choice__hit">
      <Checkbox.Root id="{uid}-updates" name="updates" {disabled} {required} class={controlClass} data-tx-choice="checkbox" data-demo-part="Checkbox.Root" data-demo-item="updates">
        {#snippet children({ checked, indeterminate })}
          {@render indicator(checked, indeterminate)}
        {/snippet}
      </Checkbox.Root>
    </span>
    <div class="tx-choice__copy">
      <label class="tx-choice__label" for="{uid}-updates">Weekly digest</label>
      <p class="tx-choice__description">One fictional summary every Monday.</p>
    </div>
  </div>
  <Checkbox.Group defaultValue={['email']} name="channels" {disabled} {required} aria-label="Notify me by" class={groupClass} data-demo-part="Checkbox.Group">
    {@render channelList()}
  </Checkbox.Group>
{:else}
  <div class="tx-choice" data-tx-choice-field="checkbox">
    <span class="tx-choice__hit">
      <Checkbox.Root
        id="{uid}-all"
        checked={all}
        indeterminate={some}
        {disabled}
        onCheckedChange={(next) => (channels = next ? [...ALL] : [])}
        class={controlClass}
        data-tx-choice="checkbox"
        data-demo-part="Checkbox.Root"
        data-demo-item="all"
      >
        {#snippet children({ checked, indeterminate })}
          {@render indicator(checked, indeterminate)}
        {/snippet}
      </Checkbox.Root>
    </span>
    <div class="tx-choice__copy">
      <label class="tx-choice__label" for="{uid}-all">All channels</label>
    </div>
  </div>
  <Checkbox.Group bind:value={channels} name="channels" {disabled} {required} aria-label="Notify me by" class={groupClass} data-demo-part="Checkbox.Group">
    {@render channelList()}
  </Checkbox.Group>
  <div class="demo-controls">
    <output data-demo-readout>value: [{channels.join(', ')}]</output>
    <Button size="sm" variant="outline" onclick={() => (channels = [...ALL])} data-demo-act="all">Select all</Button>
    <Button size="sm" variant="ghost" onclick={() => (channels = [])}>Clear</Button>
  </div>
{/if}
