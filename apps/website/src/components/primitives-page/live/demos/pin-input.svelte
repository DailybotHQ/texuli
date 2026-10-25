<script lang="ts" module>
import { attr, type DemoSpec, recipeLine, SCRIPT_END } from '../types.ts';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const spec: DemoSpec = {
  props: [
    { kind: 'number', name: 'maxlength', label: 'maxlength', min: 4, max: 8, step: 1, default: 6 },
    { kind: 'enum', name: 'size', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
    { kind: 'boolean', name: 'mask', label: 'mask', default: false },
    { kind: 'boolean', name: 'disabled', label: 'disabled', default: false },
  ],
  keys: [
    { keys: DIGITS, action: 'Type a digit into the next cell (letters are refused)' },
    { keys: ['Backspace'], action: 'Delete the previous digit' },
    { keys: ['ArrowLeft', 'ArrowRight'], action: 'Move the caret between filled cells' },
  ],
  uncontrolled: 'A plain value (no binding): the code lives inside the pin input.',
  controlled: 'bind:value keeps the code in your state, so buttons outside can fill or clear it.',
  code: (v) => `<script lang="ts">
  import { PinInput, REGEXP_ONLY_DIGITS } from '@texuli/primitives/pin-input';
  let value = $state('');
${SCRIPT_END}

<label for="otp">Verification code</label>
<PinInput.Root bind:value inputId="otp" maxlength={${v.maxlength}} pattern={REGEXP_ONLY_DIGITS}${attr('mask', v.mask === true, false)}${attr('disabled', v.disabled === true, false)}>
  {#snippet children({ cells })}
    {#each cells as cell, index (index)}
      <PinInput.Cell {cell} />
    {/each}
  {/snippet}
</PinInput.Root>
${recipeLine('pinInputClass', 'texuli/number-pin', { size: String(v.size) })}`,
  keyCheck: {
    focus: 'input.tx-pin-input__input',
    press: '4',
    expect: { selector: '[data-demo-part="PinInput.Cell"][data-state="filled"]', count: 1 },
  },
  controlCheck: {
    act: '[data-demo-act="fill"]',
    expect: { selector: '[data-demo-part="PinInput.Cell"][data-state="filled"]', count: 4 },
  },
};
</script>

<script lang="ts">
import { PinInput, REGEXP_ONLY_DIGITS } from '@texuli/primitives/pin-input';
import { Button } from 'texuli/button';
import { pinInputClass } from 'texuli/number-pin';
import { bool, type DemoProps, num, str } from '../types.ts';

let { values, mode }: DemoProps = $props();

const maxlength = $derived(num(values, 'maxlength', 6));
const size = $derived.by(() => {
  const raw = str(values, 'size', 'md');
  return raw === 'sm' || raw === 'lg' ? raw : 'md';
});
const mask = $derived(bool(values, 'mask'));
const disabled = $derived(bool(values, 'disabled'));
const rootClass = $derived(pinInputClass({ size }));
const inputId = $derived(`demo-pin-${mode}`);

let value = $state('');
</script>

<label class="demo-pin__label" for={inputId}>Verification code</label>
<!-- The root's own attributes land on its real input, so this wrapper marks the part. -->
<div class="demo-pin" data-demo-part="PinInput.Root">
  {#if mode === 'uncontrolled'}
    <PinInput.Root value="" {inputId} {maxlength} pattern={REGEXP_ONLY_DIGITS} {mask} {disabled} class={rootClass}>
      {#snippet children({ cells })}
        <div class="tx-pin-input__cells" aria-hidden="true">
          {#each cells as cell, index (index)}
            <PinInput.Cell {cell} class="tx-pin-input__cell" data-demo-part="PinInput.Cell" />
          {/each}
        </div>
      {/snippet}
    </PinInput.Root>
  {:else}
    <PinInput.Root bind:value {inputId} {maxlength} pattern={REGEXP_ONLY_DIGITS} {mask} {disabled} class={rootClass}>
      {#snippet children({ cells })}
        <div class="tx-pin-input__cells" aria-hidden="true">
          {#each cells as cell, index (index)}
            <PinInput.Cell {cell} class="tx-pin-input__cell" data-demo-part="PinInput.Cell" />
          {/each}
        </div>
      {/snippet}
    </PinInput.Root>
  {/if}
</div>
{#if mode === 'controlled'}
  <div class="demo-controls">
    <output data-demo-readout>Code: {value || 'empty'}</output>
    <Button size="sm" variant="outline" onclick={() => (value = '2468'.slice(0, maxlength))} data-demo-act="fill">Fill 2468</Button>
    <Button size="sm" variant="ghost" onclick={() => (value = '')}>Clear</Button>
  </div>
{/if}

<style>
  .demo-pin {
    inline-size: max-content;
    max-inline-size: 100%;
  }
  .demo-pin__label {
    font-size: 0.875rem;
    font-weight: 500;
  }
</style>
