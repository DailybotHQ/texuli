<script lang="ts">
// Checkbox scenario: @texuli/primitives Checkbox public API.
// Relative path keeps the lane worktree off a parent monorepo's stale package.json.
import { Checkbox } from '../../../../packages/primitives/src/checkbox/index.ts';
import { behaviorEvent } from '../../harness/client/events.ts';

let checked = $state(false);
let indeterminate = $state(false);
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
    behaviorEvent('submit', Object.fromEntries(new FormData(event.currentTarget)));
  }}
>
  <div>
    <Checkbox.Root
      id="updates"
      name="updates"
      value="yes"
      bind:checked
      bind:indeterminate
      aria-describedby="updates-description"
      onCheckedChange={(next) => behaviorEvent('checkedChange', next)}
    >
      {#snippet children({ checked, indeterminate })}
        <span aria-hidden="true">{indeterminate ? '–' : checked ? '✓' : ''}</span>
      {/snippet}
    </Checkbox.Root>
    <label for="updates">Email updates</label>
    <p id="updates-description">One fictional digest a week.</p>
  </div>
  <div>
    <Checkbox.Root id="locked" disabled />
    <label for="locked">Locked option</label>
  </div>
  <button type="button" onclick={() => (indeterminate = true)}>Mark partly selected</button>
  <button type="submit">Save preferences</button>
</form>
