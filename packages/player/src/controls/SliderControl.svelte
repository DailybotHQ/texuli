<script lang="ts">
import { getPlayerInteraction, getPlayerStateAccess } from '../context.ts';

let {
  state: stateName,
  txPath,
  label,
  step = 1,
}: { state: string; label: string; step?: number; txPath?: string } = $props();
const access = getPlayerStateAccess();
const interaction = getPlayerInteraction();
/** Write the variable, then run the node's `on.change` actions (spec 0.3.0). */
function write(value: unknown): void {
  if (access?.write(stateName, value) && txPath !== undefined) {
    interaction?.dispatch(txPath, 'change', { value });
  }
}
const id = $props.id();
let declaration = $derived(access?.declaration(stateName));
let min = $derived(declaration?.type === 'number' ? declaration.min : 0);
let max = $derived(declaration?.type === 'number' ? declaration.max : 0);
let value = $derived(Number(access?.read(stateName) ?? min));
let safeStep = $derived(
  Number.isFinite(step) && step > 0 && step <= Math.max(max - min, 1) ? step : 1
);
</script>

<div class="tx-player-control tx-player-control--slider" data-tx-player-control="slider">
  <label for={id}>{label}</label>
  <input
    {id}
    type="range"
    {min}
    {max}
    step={safeStep}
    {value}
    disabled={!access}
    oninput={(event) => write(Number((event.currentTarget as HTMLInputElement).value))}
  />
  <output for={id}>{value}</output>
</div>
