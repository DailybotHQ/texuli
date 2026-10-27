<script lang="ts">
import { getPlayerFlowAccess, getPlayerInteraction } from '../context.ts';

let { event, label, txPath }: { event: string; label: string; txPath?: string } = $props();
const access = getPlayerFlowAccess();
const interaction = getPlayerInteraction();
let available = $derived(access?.can(event) === true);
</script>

<!-- type="button": an action changes the local view only, never submits. -->
<button
  type="button"
  class="tx-player-flow-action"
  data-tx-player-flow-action={event}
  aria-disabled={!available}
  onclick={() => {
    if (available) access?.dispatch(event);
    // Spec 0.3.0: a press also runs the node's `on.press` actions.
    if (txPath !== undefined) interaction?.dispatch(txPath, 'press');
  }}
>
  {label}
</button>
