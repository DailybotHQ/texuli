<script lang="ts">
import { getPlayerStateAccess } from '../context.ts';

let {
  state: stateName,
  label,
  step = 1,
}: { state: string; label: string; step?: number } = $props();
const access = getPlayerStateAccess();
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
    oninput={(event) => access?.write(stateName, Number((event.currentTarget as HTMLInputElement).value))}
  />
  <output for={id}>{value}</output>
</div>
