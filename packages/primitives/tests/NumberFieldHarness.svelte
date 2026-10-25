<script lang="ts">
import { NumberField, type NumberFormatOptions } from '../src/number-field/index.ts';

let {
  value = $bindable(),
  defaultValue,
  min,
  max,
  step,
  largeStep,
  locale = 'en-US',
  formatOptions,
  disabled = false,
  readOnly = false,
  required = false,
  snapOnStep = false,
  allowWheel = false,
  name,
  incrementLabel,
  decrementLabel,
  childInput = false,
  onValueChange,
}: {
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  locale?: string;
  formatOptions?: NumberFormatOptions;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  snapOnStep?: boolean;
  allowWheel?: boolean;
  name?: string;
  incrementLabel?: string;
  decrementLabel?: string;
  childInput?: boolean;
  onValueChange?: (value: number | null) => void;
} = $props();
</script>

<form data-testid="form">
  <NumberField.Root
    bind:value
    {defaultValue}
    {min}
    {max}
    {step}
    {largeStep}
    {locale}
    {formatOptions}
    {disabled}
    {readOnly}
    {required}
    {snapOnStep}
    {allowWheel}
    {name}
    {incrementLabel}
    {decrementLabel}
    {onValueChange}
    data-testid="root"
  >
    <NumberField.Decrement />
    {#if childInput}
      <NumberField.Input aria-label="Quantity">
        {#snippet child({ props })}<input {...props} data-custom="" />{/snippet}
      </NumberField.Input>
    {:else}
      <NumberField.Input aria-label="Quantity" />
    {/if}
    <NumberField.Increment />
  </NumberField.Root>
  <button type="reset">Reset</button>
</form>
<output data-testid="value">{value === null ? 'null' : String(value)}</output>
<button type="button" data-testid="elsewhere">Elsewhere</button>
