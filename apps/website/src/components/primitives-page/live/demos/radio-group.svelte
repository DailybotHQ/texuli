<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    {
      kind: 'enum',
      name: 'orientation',
      label: 'orientation',
      options: ['vertical', 'horizontal'],
      default: 'vertical',
    },
    { kind: 'boolean', name: 'loop', label: 'loop', default: true },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md'], default: 'md' },
  ],
  keys: [
    {
      keys: ['ArrowDown', 'ArrowRight'],
      action: 'Check the next option (mirrored in right-to-left)',
    },
    { keys: ['ArrowUp', 'ArrowLeft'], action: 'Check the previous option' },
    { keys: [' '], action: 'Check the focused option' },
    { keys: ['Tab'], action: 'Enter the group on the checked option, or leave it' },
  ],
  uncontrolled:
    'A plain value (no binding) checks "Standard" first; the group keeps its own value.',
  controlled: 'bind:value keeps the choice in your state, so a button outside can change it.',
  code: (v) => `<script lang="ts">
  import { RadioGroup } from '@texuli/primitives/radio-group';
  let value = $state('standard');
${SCRIPT_END}

<span id="delivery">Delivery</span>
<RadioGroup.Root bind:value name="delivery" aria-labelledby="delivery"${attr('orientation', String(v.orientation), 'vertical')}${attr('loop', v.loop === true, true)}${attr('disabled', v.disabled === true, false)}>
  <RadioGroup.Item id="standard" value="standard" />
  <label for="standard">Standard</label>
  <RadioGroup.Item id="express" value="express" />
  <label for="express">Express</label>
</RadioGroup.Root>
${recipeLine('choiceControlClass', 'texuli/choice', { size: String(v.size) })}`,
  keyCheck: {
    focus: '[data-demo-part="RadioGroup.Item"][aria-checked="true"]',
    press: 'ArrowDown',
    expect: {
      selector: '[data-demo-part="RadioGroup.Item"][value="express"]',
      attribute: 'aria-checked',
      value: 'true',
    },
  },
  controlCheck: {
    act: '[data-demo-act="drone"]',
    expect: {
      selector: '[data-demo-part="RadioGroup.Item"][value="drone"]',
      attribute: 'aria-checked',
      value: 'true',
    },
  },
};
</script>

<script lang="ts">
import { RadioGroup } from '@texuli/primitives/radio-group';
import { Button } from 'texuli/button';
import { choiceControlClass, radioGroupClass } from 'texuli/choice';
import { bool, type DemoProps, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const OPTIONS = [
  { value: 'standard', label: 'Standard (3 to 5 days)' },
  { value: 'express', label: 'Express (next day)' },
  { value: 'pickup', label: 'Pickup (unavailable)', disabled: true },
  { value: 'drone', label: 'Drone' },
];

const orientation = $derived(str(values, 'orientation', 'vertical') === 'horizontal' ? 'horizontal' : 'vertical');
const loop = $derived(bool(values, 'loop', true));
const disabled = $derived(bool(values, 'disabled'));
const size = $derived(str(values, 'size', 'md') === 'sm' ? 'sm' : 'md');
const groupClass = $derived(radioGroupClass({ orientation }));
const controlClass = $derived(choiceControlClass({ size, class: 'tx-choice-control--radio' }));
const labelId = $derived(`demo-radio-${mode}-label`);

let value = $state('standard');
</script>

{#snippet options()}
  {#each OPTIONS as option (option.value)}
    {@const id = `demo-radio-${mode}-${option.value}`}
    <div class="tx-choice" data-tx-choice-field="radio">
      <span class="tx-choice__hit">
        <RadioGroup.Item {id} value={option.value} disabled={option.disabled} class={controlClass} data-tx-choice="radio" data-demo-part="RadioGroup.Item">
          {#snippet children({ checked })}
            {#if checked}<span class="tx-choice-control__dot"></span>{/if}
          {/snippet}
        </RadioGroup.Item>
      </span>
      <div class="tx-choice__copy">
        <label class="tx-choice__label" for={id}>{option.label}</label>
      </div>
    </div>
  {/each}
{/snippet}

<span class="demo-radio__label" id={labelId}>Delivery</span>
{#key orientation}
  {#if mode === 'uncontrolled'}
    <RadioGroup.Root value="standard" name="delivery-uncontrolled" aria-labelledby={labelId} {orientation} {loop} {disabled} class={groupClass} data-tx-choice="radio-group" data-variant="default" data-demo-part="RadioGroup.Root">
      {@render options()}
    </RadioGroup.Root>
  {:else}
    <RadioGroup.Root bind:value name="delivery-controlled" aria-labelledby={labelId} {orientation} {loop} {disabled} class={groupClass} data-tx-choice="radio-group" data-variant="default" data-demo-part="RadioGroup.Root">
      {@render options()}
    </RadioGroup.Root>
  {/if}
{/key}
{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>value: {value}</output>
    <Button size="sm" variant="outline" onclick={() => (value = 'drone')} data-demo-act="drone">Choose Drone</Button>
  </div>
{/if}

<style>
  .demo-radio__label {
    font-size: 0.875rem;
    font-weight: 500;
  }
</style>
