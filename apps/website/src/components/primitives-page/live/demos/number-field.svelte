<script lang="ts" module>
import { attr, type DemoSpec, SCRIPT_END } from '../types.ts';

export const spec: DemoSpec = {
  props: [
    { kind: 'number', name: 'step', label: 'step', min: 1, max: 5, step: 1, default: 1 },
    {
      kind: 'enum',
      name: 'format',
      label: 'formatOptions',
      options: ['decimal', 'currency'],
      default: 'decimal',
    },
    {
      kind: 'enum',
      name: 'locale',
      label: 'locale',
      options: ['en-US', 'de-DE'],
      default: 'en-US',
    },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: ['ArrowUp', 'ArrowDown'], action: 'Step up or down' },
    { keys: ['PageUp', 'PageDown'], action: 'Step by largeStep' },
    { keys: ['Home', 'End'], action: 'Go to min or max' },
    { keys: ['Enter'], action: 'Commit the typed draft' },
  ],
  uncontrolled:
    'defaultValue starts at 2 (0 to 20); the field keeps its own number and parses what you type.',
  controlled: 'bind:value holds a number or null in your state; buttons outside set or clear it.',
  code: (v) => `<script lang="ts">
  import { NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput, NumberFieldRoot } from '@texuli/primitives/number-field';
  let quantity = $state<number | null>(2);
${SCRIPT_END}

<label for="quantity-input">Quantity</label>
<NumberFieldRoot id="quantity" bind:value={quantity} min={0} max={20}${attr('step', Number(v.step), 1)}${attr('locale', String(v.locale), 'en-US')}${v.format === 'currency' ? " formatOptions={{ style: 'currency', currency: 'EUR' }}" : ''}${attr('disabled', v.disabled === true, false)}>
  <NumberFieldDecrement />
  <NumberFieldInput />
  <NumberFieldIncrement />
</NumberFieldRoot>`,
  keyCheck: {
    focus: '[data-demo-part="NumberFieldInput"]',
    press: 'ArrowUp',
    expect: {
      selector: '[data-demo-part="NumberFieldInput"]',
      attribute: 'aria-valuenow',
      value: '3',
    },
  },
  controlCheck: {
    act: '[data-demo-act="ten"]',
    expect: {
      selector: '[data-demo-part="NumberFieldInput"]',
      attribute: 'aria-valuenow',
      value: '10',
    },
  },
};
</script>

<script lang="ts">
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from '@texuli/primitives/number-field';
import { Button } from 'texuli/button';
import { labelClass } from 'texuli/field';
import { numberFieldClass } from 'texuli/number-pin';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const step = $derived(num(values, 'step', 1));
const locale = $derived(str(values, 'locale', 'en-US'));
const currency = $derived(str(values, 'format', 'decimal') === 'currency');
const formatOptions = $derived<Intl.NumberFormatOptions>(
  currency ? { style: 'currency', currency: 'EUR' } : {}
);
const disabled = $derived(bool(values, 'disabled'));
const id = $derived(`live-number-field-${mode}`);

let quantity = $state<number | null>(4);
</script>

{#snippet parts()}
  <NumberFieldDecrement class="tx-number-field__stepper" data-demo-part="NumberFieldDecrement">
    <span aria-hidden="true">−</span>
  </NumberFieldDecrement>
  <NumberFieldInput class="tx-number-field__input" data-demo-part="NumberFieldInput" />
  <NumberFieldIncrement class="tx-number-field__stepper" data-demo-part="NumberFieldIncrement">
    <span aria-hidden="true">+</span>
  </NumberFieldIncrement>
{/snippet}

<label class={labelClass()} data-tx-label="" for="{id}-input">{mode === 'uncontrolled' ? 'Quantity' : 'Seats'}</label>
{#key `${locale}-${currency}`}
  {#if mode === 'uncontrolled'}
    <NumberFieldRoot {id} defaultValue={2} min={0} max={20} {step} {locale} {formatOptions} {disabled} class={numberFieldClass()} data-tx-number-field="" data-demo-part="NumberFieldRoot">
      {@render parts()}
    </NumberFieldRoot>
  {:else}
    <NumberFieldRoot {id} bind:value={quantity} min={0} max={20} {step} {locale} {formatOptions} {disabled} class={numberFieldClass()} data-tx-number-field="" data-demo-part="NumberFieldRoot">
      {@render parts()}
    </NumberFieldRoot>
  {/if}
{/key}
{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>value: {quantity ?? 'null'}</output>
    <Button size="sm" variant="outline" onclick={() => (quantity = 10)} data-demo-act="ten">Set 10</Button>
    <Button size="sm" variant="ghost" onclick={() => (quantity = null)}>Clear</Button>
  </div>
{/if}
