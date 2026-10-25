<script lang="ts">
import { getPlayerStateAccess } from '../context.ts';

let { state: stateName, label }: { state: string; label: string } = $props();
const access = getPlayerStateAccess();
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
  onclick={() => access?.write(stateName, !checked)}
>
  <span class="tx-player-control__track" aria-hidden="true"><span class="tx-player-control__thumb"></span></span>
  <span>{label}</span>
</button>
