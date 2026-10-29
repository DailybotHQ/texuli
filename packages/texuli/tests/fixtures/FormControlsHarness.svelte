<script lang="ts">
/**
 * G40–G42: a multiple ToggleGroup inside a form (`name` submits each pressed
 * value; the roving tab stop starts on the first pressed item), and a styled
 * PinInput.Root forwarding `name` and `bind:inputRef`.
 */
import { PinInput } from '../../src/components/number-pin/index.ts';
import { ToggleGroup, ToggleGroupItem } from '../../src/components/toggle/index.ts';

let {
  pinRef = $bindable(null as HTMLInputElement | null),
}: {
  pinRef?: HTMLInputElement | null;
} = $props();
</script>

<form data-testid="form">
  <ToggleGroup
    type="multiple"
    name="days"
    value={['tue', 'thu']}
    aria-label="Days"
    id="days-group"
    aria-describedby="days-note"
  >
    <ToggleGroupItem value="mon">Mon</ToggleGroupItem>
    <ToggleGroupItem value="tue">Tue</ToggleGroupItem>
    <ToggleGroupItem value="wed" disabled>Wed</ToggleGroupItem>
    <ToggleGroupItem value="thu">Thu</ToggleGroupItem>
  </ToggleGroup>
  <p id="days-note">Pick days</p>
  <PinInput.Root name="code" value="12" maxlength={4} aria-label="Code" bind:inputRef={pinRef} />
</form>
