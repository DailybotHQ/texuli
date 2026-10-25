<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
    {
      kind: 'enum',
      name: 'variant',
      label: 'Style',
      options: ['outline', 'soft'],
      default: 'outline',
    },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
    { kind: 'string', name: 'placeholder', label: 'placeholder', default: 'Choose a plan' },
  ],
  keys: [
    {
      keys: ['Enter', ' ', 'ArrowDown', 'ArrowUp'],
      action: 'Open the list from the trigger; Enter or Space then picks',
    },
    { keys: ['Home', 'End'], action: 'Highlight the first or last option' },
    { keys: ['Escape'], action: 'Close and return focus to the trigger' },
    { keys: ['t', 'e', 'f'], action: 'Typeahead: jump to the option starting with the letter' },
  ],
  uncontrolled: 'defaultValue picks "Team"; the select keeps its own value (no binding).',
  controlled: 'bind:value keeps the plan in your state, so a button outside can change it.',
  code: (v) => `<script lang="ts">
  import { Select } from '@texuli/primitives/select';
  const items = [{ value: 'free', label: 'Free' }, { value: 'team', label: 'Team' }];
  let value = $state('team');
${SCRIPT_END}

<span id="plan">Plan</span>
<Select.Root type="single" bind:value {items} name="plan"${attr('disabled', v.disabled === true, false)}>
  <Select.Trigger aria-labelledby="plan">
    <Select.Value placeholder="${v.placeholder}" />
  </Select.Trigger>
  <Select.Portal>
    <Select.Content aria-label="Plans">
      <Select.Viewport>
        <Select.Group>
          <Select.GroupLabel>Personal</Select.GroupLabel>
          <Select.Item value="free" label="Free" />
        </Select.Group>
        <Select.Item value="team" label="Team" />
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
${recipeLine('selectTriggerClass', 'texuli/select', { size: String(v.size), variant: String(v.variant) })}`,
  keyCheck: {
    focus: '[data-demo-part="Select.Trigger"]',
    press: 'ArrowDown',
    expect: {
      selector: '[data-demo-part="Select.Trigger"]',
      attribute: 'aria-expanded',
      value: 'true',
    },
  },
  controlCheck: {
    act: '[data-demo-act="enterprise"]',
    expect: {
      selector: '[data-demo-part="Select.Value"]',
      attribute: 'data-value',
      value: 'enterprise',
    },
  },
};
</script>

<script lang="ts">
import { Select } from '@texuli/primitives/select';
import { Button } from 'texuli/button';
import {
  selectContentClass,
  selectGroupClass,
  selectItemClass,
  selectLabelClass,
  selectTriggerClass,
  selectValueClass,
} from 'texuli/select';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const ITEMS = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
  { value: 'business', label: 'Business (sold out)', disabled: true },
  { value: 'enterprise', label: 'Enterprise' },
];

const SIZES = ['sm', 'md', 'lg'] as const;
const size = $derived(SIZES.find((entry) => entry === str(values, 'size')) ?? 'md');
const variant = $derived(str(values, 'variant', 'outline') === 'soft' ? 'soft' : 'outline');
const disabled = $derived(bool(values, 'disabled'));
const placeholder = $derived(str(values, 'placeholder', 'Choose a plan'));
const labelId = $derived(`demo-select-${mode}-label`);

let value = $state('team');
</script>

{#snippet parts()}
  <Select.Trigger class={selectTriggerClass({ size, variant })} data-tx-select-trigger="" data-size={size} data-variant={variant} aria-labelledby={labelId} data-demo-part="Select.Trigger">
    <span class="tx-select-trigger__body">
      <Select.Value {placeholder}>
        {#snippet children({ value: current, label })}
          <span class={selectValueClass({ placeholder: !label })} data-tx-select-value="" data-value={current} data-demo-part="Select.Value">{label || placeholder}</span>
        {/snippet}
      </Select.Value>
    </span>
    <svg class="tx-select-trigger__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4.5 6.25 8 9.75l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </Select.Trigger>
  <Select.Portal>
    <Select.Content class={selectContentClass({ size })} data-tx-select-content="" data-size={size} aria-label="Plans" data-demo-part="Select.Content">
      <Select.Viewport class="tx-select-viewport" data-tx-select-viewport="" data-demo-part="Select.Viewport">
        <Select.Group class={selectGroupClass()} data-demo-part="Select.Group">
          <Select.GroupLabel class={selectLabelClass()} data-tx-select-label="" data-demo-part="Select.GroupLabel">Personal</Select.GroupLabel>
          {@render item(ITEMS[0])}
        </Select.Group>
        <Select.Group class={selectGroupClass()} data-demo-part="Select.Group">
          <Select.GroupLabel class={selectLabelClass()} data-tx-select-label="" data-demo-part="Select.GroupLabel">Organization</Select.GroupLabel>
          {@render item(ITEMS[1])}
          {@render item(ITEMS[2])}
        </Select.Group>
        {@render item(ITEMS[3])}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
{/snippet}

{#snippet item(option: { value: string; label: string; disabled?: boolean } | undefined)}
  {#if option}
    <Select.Item value={option.value} label={option.label} disabled={option.disabled} class={selectItemClass({ disabled: option.disabled })} data-tx-select-item="" data-demo-part="Select.Item">
      <span class="tx-select-item__check" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
          <path d="M3.5 8.25 6.75 11.5 12.5 4.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
      <span class="tx-select-item__body"><span class="tx-select-item__label">{option.label}</span></span>
    </Select.Item>
  {/if}
{/snippet}

<span class="demo-select__label" id={labelId}>Plan</span>
{#if mode === 'uncontrolled'}
  <Select.Root type="single" defaultValue="team" items={ITEMS} name="plan-uncontrolled" {disabled}>
    {@render parts()}
  </Select.Root>
{:else}
  <Select.Root type="single" bind:value items={ITEMS} name="plan-controlled" {disabled}>
    {@render parts()}
  </Select.Root>
  <div class="demo-controls">
    <output data-demo-readout>value: {value || 'none'}</output>
    <Button size="sm" variant="outline" onclick={() => (value = 'enterprise')} data-demo-act="enterprise">Choose Enterprise</Button>
    <Button size="sm" variant="ghost" onclick={() => (value = '')}>Clear</Button>
  </div>
{/if}

<style>
  .demo-select__label {
    font-size: 0.875rem;
    font-weight: 500;
  }
</style>
