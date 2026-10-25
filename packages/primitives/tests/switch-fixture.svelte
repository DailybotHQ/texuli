<script lang="ts">
import { Switch } from '../src/switch/index.ts';

let {
  onCheckedChange,
}: {
  onCheckedChange?: (checked: boolean) => void;
} = $props();

let checked = $state(false);
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
  }}
>
  <div>
    <Switch.Root
      id="airplane"
      name="airplane"
      value="on"
      bind:checked
      aria-describedby="airplane-description"
      {onCheckedChange}
    >
      <Switch.Thumb />
    </Switch.Root>
    <label for="airplane">Airplane mode</label>
    <p id="airplane-description">Turns off every fictional radio.</p>
  </div>
  <div>
    <Switch.Root id="locked-switch" disabled>
      <Switch.Thumb />
    </Switch.Root>
    <label for="locked-switch">Managed setting</label>
  </div>
  <button type="submit">Save settings</button>
</form>
