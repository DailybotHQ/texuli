<script lang="ts">
import { Player, type PlayerDiagnosticsEvent } from '@texuli/player';

let { example, label, blueprint }: { example: string; label: string; blueprint: unknown } =
  $props();

let root = $state<HTMLElement>();
let diagnostics = $state<PlayerDiagnosticsEvent | null>(null);
let phase = $state<'loading' | 'ready' | 'error'>('loading');

// Nodes still loading: player skeletons, pending chart plots, chart-block placeholders.
const PENDING = '[aria-busy="true"], [data-chart-pending], .tx-block-chart-loading';

// The player and its chart families load lazily. Report ready only after the
// blueprint validated and nothing is pending for two frames in a row, so
// captures never see a skeleton; refusals and node errors fail loudly.
$effect(() => {
  if (!root || !diagnostics) return;
  const element = root;
  const event = diagnostics;
  let frame = 0;
  let quiet = 0;
  const check = () => {
    if (event.surface !== 'tree' || element.querySelector('[data-tx-player-error]')) {
      phase = 'error';
      return;
    }
    quiet = element.querySelector(PENDING) ? 0 : quiet + 1;
    if (quiet >= 2) phase = 'ready';
    else frame = requestAnimationFrame(check);
  };
  frame = requestAnimationFrame(check);
  return () => cancelAnimationFrame(frame);
});
</script>

{#if phase === 'loading'}
  <p role="status">Loading player…</p>
{:else if phase === 'error'}
  <p role="alert">The player refused this blueprint or a node failed to paint.</p>
{/if}
<div
  class="demo"
  data-example={example}
  data-player-surface={diagnostics?.surface ?? 'pending'}
  bind:this={root}
>
  <Player {blueprint} {label} onDiagnostics={(event) => (diagnostics = event)} />
</div>

<style>
  .demo {
    max-inline-size: 64rem;
    color: var(--tx-foreground, CanvasText);
  }
</style>
