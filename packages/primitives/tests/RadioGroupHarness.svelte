<script lang="ts">
import { RadioGroup } from '../src/radio-group/index.ts';

const options = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'pickup', label: 'Pickup', disabled: true },
  { value: 'drone', label: 'Drone' },
];

interface Props {
  value?: string;
  name?: string;
  readonly?: boolean;
  disabled?: boolean;
  labelledBy?: string;
  onValueChange?: (value: string) => void;
}

let {
  value = $bindable('standard'),
  name = 'delivery',
  readonly = false,
  disabled = false,
  labelledBy = 'delivery-label',
  onValueChange,
}: Props = $props();
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
  }}
>
  <span id={labelledBy}>Delivery</span>
  <RadioGroup.Root
    aria-labelledby={labelledBy}
    {name}
    bind:value
    {readonly}
    {disabled}
    {onValueChange}
  >
    {#each options as option (option.value)}
      <div>
        <RadioGroup.Item
          id={`delivery-${option.value}`}
          value={option.value}
          disabled={option.disabled}
        />
        <label for={`delivery-${option.value}`}>{option.label}</label>
      </div>
    {/each}
  </RadioGroup.Root>
  <button type="submit">Confirm delivery</button>
</form>
