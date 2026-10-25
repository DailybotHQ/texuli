<script lang="ts">
// Switch scenario: @texuli/primitives Switch public API only.
// Relative import keeps Vite on this worktree (lane node_modules does not hoist @texuli/*).
import { Switch } from '../../../../packages/primitives/src/switch/index.ts';
import { behaviorEvent } from '../../harness/client/events.ts';

let checked = $state(false);
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
    behaviorEvent('submit', Object.fromEntries(new FormData(event.currentTarget)));
  }}
>
  <div>
    <Switch.Root
      id="airplane"
      name="airplane"
      value="on"
      bind:checked
      aria-describedby="airplane-description"
      onCheckedChange={(next) => behaviorEvent('checkedChange', next)}
    >
      <Switch.Thumb />
    </Switch.Root>
    <label for="airplane">Airplane mode</label>
    <p id="airplane-description">Turns off every fictional radio.</p>
  </div>
  <div>
    <Switch.Root id="locked-switch" disabled><Switch.Thumb /></Switch.Root>
    <label for="locked-switch">Managed setting</label>
  </div>
  <button type="submit">Save settings</button>
</form>
