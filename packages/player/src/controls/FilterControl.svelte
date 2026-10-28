<script lang="ts">
import { getPlayerInteraction, getPlayerStateAccess } from '../context.ts';

let {
  state: stateName,
  txPath,
  label,
  placeholder,
}: { state: string; label: string; placeholder?: string; txPath?: string } = $props();
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
let maxLength = $derived(declaration?.type === 'string' ? declaration.maxLength : 0);
let value = $derived(String(access?.read(stateName) ?? ''));

// Enter never submits, even when a host wraps the player in a form.
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') event.preventDefault();
}
</script>

<div class="tx-player-control tx-player-control--filter" data-tx-player-control="filter">
  <label for={id}>{label}</label>
  <input
    {id}
    type="search"
    maxlength={maxLength}
    {value}
    {placeholder}
    autocomplete="off"
    disabled={!access}
    onkeydown={onKeydown}
    oninput={(event) => write((event.currentTarget as HTMLInputElement).value)}
  />
</div>
