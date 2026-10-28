<script lang="ts">
import { getPlayerInteraction, getPlayerStateAccess } from '../context.ts';

let {
  state: stateName,
  label,
  txPath,
}: { state: string; label: string; txPath?: string } = $props();
const access = getPlayerStateAccess();
const interaction = getPlayerInteraction();
/** Write the variable, then run the node's `on.change` actions (spec 0.3.0). */
function write(value: unknown): void {
  if (access?.write(stateName, value) && txPath !== undefined) {
    interaction?.dispatch(txPath, 'change', { value });
  }
}
let checked = $derived(access?.read(stateName) === true);
</script>

<!-- type="button": a control never submits, not even inside a host form. -->
<button
  type="button"
  class="tx-player-control tx-player-control--toggle"
  role="switch"
  aria-checked={checked}
  data-tx-player-control="toggle"
  disabled={!access}
  onclick={() => write(!checked)}
>
  <span class="tx-player-control__track" aria-hidden="true"><span class="tx-player-control__thumb"></span></span>
  <span>{label}</span>
</button>
