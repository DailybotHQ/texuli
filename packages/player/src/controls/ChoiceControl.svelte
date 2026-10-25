<script lang="ts">
import { getPlayerStateAccess } from '../context.ts';

let { state: stateName, label }: { state: string; label: string } = $props();
const access = getPlayerStateAccess();
let declaration = $derived(access?.declaration(stateName));
let values = $derived(declaration?.type === 'enum' ? declaration.values : []);
let current = $derived(access?.read(stateName));
let group = $state<HTMLElement | null>(null);

function choose(value: string, focus = false): void {
  access?.write(stateName, value);
  if (focus) {
    queueMicrotask(() =>
      group?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`)?.focus()
    );
  }
}

// Radio group keys (APG): arrows move and select, Home and End jump.
function onKeydown(event: KeyboardEvent): void {
  const index = values.indexOf(String(current));
  const last = values.length - 1;
  const rtl = group?.closest('[dir]')?.getAttribute('dir') === 'rtl';
  let next = -1;
  if (event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) {
    next = index >= last ? 0 : index + 1;
  } else if (event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) {
    next = index <= 0 ? last : index - 1;
  } else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = last;
  const value = values[next];
  if (value === undefined) return;
  event.preventDefault();
  choose(value, true);
}
</script>

<div
  bind:this={group}
  class="tx-player-control tx-player-control--choice"
  role="radiogroup"
  aria-label={label}
  data-tx-player-control="choice"
  tabindex="-1"
  onkeydown={onKeydown}
>
  {#each values as value (value)}
    <button
      type="button"
      role="radio"
      aria-checked={current === value}
      tabindex={current === value ? 0 : -1}
      data-value={value}
      disabled={!access}
      onclick={() => choose(value)}
    >
      {value}
    </button>
  {/each}
</div>
