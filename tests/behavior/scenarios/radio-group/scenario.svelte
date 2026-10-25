<script lang="ts">
// RadioGroup scenario: @texuli/primitives RadioGroup only.
import { RadioGroup } from '../../../../packages/primitives/src/radio-group/index.ts';
import { behaviorEvent } from '../../harness/client/events.ts';

const options = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'pickup', label: 'Pickup', disabled: true },
  { value: 'drone', label: 'Drone' },
];
// `?value=` starts on another radio (the tab-stop rows use it).
let value = $state(new URLSearchParams(location.search).get('value') ?? 'standard');
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
    behaviorEvent('submit', Object.fromEntries(new FormData(event.currentTarget)));
  }}
>
  <span id="delivery-label">Delivery</span>
  <RadioGroup.Root
    aria-labelledby="delivery-label"
    name="delivery"
    bind:value
    onValueChange={(next) => behaviorEvent('valueChange', next)}
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
