<script lang="ts">
import { getPlayerFlowAccess } from '../context.ts';

let { event, label }: { event: string; label: string } = $props();
const access = getPlayerFlowAccess();
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
  }}
>
  {label}
</button>
