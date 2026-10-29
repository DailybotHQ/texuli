<script lang="ts">
/**
 * /canvas-page/ canvases as agent data: the real `<Player>` at the
 * untrusted tier paints the agent's `canvas` blueprint (spec 0.8.0)
 * through the canvas host of `@texuli/canvas/host`, which mounts the
 * read-only `CanvasViewer` (an image named by the canvas, with its shapes
 * and connectors as text for screen readers). "Send the hostile canvas"
 * swaps in a board with a raw CSS paint: the canvas validator refuses it
 * and nothing of it paints. The player and the host load after hydration.
 */
import { onMount } from 'svelte';
import { AGENT_CANVAS_BLUEPRINT, HOSTILE_CANVAS_BLUEPRINT } from './blueprint.ts';

type PlayerModule = typeof import('@texuli/player');
type CanvasHost = ReturnType<typeof import('@texuli/canvas/host')['createCanvasPlayerHost']>;
interface DiagnosticsEvent {
  readonly diagnostics: readonly { code: string; severity: string; path?: string }[];
}

let player = $state.raw<PlayerModule | null>(null);
let host = $state.raw<CanvasHost | null>(null);
let failed = $state(false);
let hostile = $state(false);
let refused = $state.raw<readonly string[]>([]);
const blueprint = $derived(hostile ? HOSTILE_CANVAS_BLUEPRINT : AGENT_CANVAS_BLUEPRINT);

onMount(() => {
  let live = true;
  Promise.all([import('@texuli/player'), import('@texuli/canvas/host')]).then(
    ([playerModule, hostModule]) => {
      if (!live) return;
      host = hostModule.createCanvasPlayerHost();
      player = playerModule;
    },
    () => {
      failed = true;
    }
  );
  return () => {
    live = false;
  };
});

function onDiagnostics(event: DiagnosticsEvent): void {
  const errors = event.diagnostics
    .filter((entry) => entry.severity === 'error')
    .map((entry) => `${entry.code}${entry.path ? ` at ${entry.path}` : ''}`);
  if (errors.length > 0 || hostile) refused = errors;
}

function toggle(next: boolean): void {
  hostile = next;
  refused = [];
}
</script>

<div class="agent-canvas" data-canvas-agent="">
  <div class="agent-canvas__bar" role="group" aria-label="Which blueprint the agent sends">
    <button type="button" class="agent-canvas__button" aria-pressed={!hostile} onclick={() => toggle(false)}
      >Send the agent’s canvas</button
    >
    <button type="button" class="agent-canvas__button" aria-pressed={hostile} onclick={() => toggle(true)}
      >Send the hostile canvas</button
    >
  </div>
  <div class="agent-canvas__status" role="status" data-canvas-agent-status="">
    {#if hostile && refused.length > 0}
      <p class="agent-canvas__refused" data-canvas-agent-refused="">
        Refused before painting: {refused.join(', ')}. Nothing of it rendered.
      </p>
    {:else}
      <p>The player validated the canvas at the untrusted tier, then painted it read-only.</p>
    {/if}
  </div>
  <div class="agent-canvas__stage" data-canvas-agent-stage="">
    {#if failed}
      <p role="alert">The player could not load. Reload the page to try again.</p>
    {:else if player && host}
      {#key hostile}
        <player.Player
          {blueprint}
          tier="untrusted"
          status="draft"
          label="Agent canvas (untrusted)"
          landmarks={false}
          loadTimeoutMs={8000}
          canvasHost={host}
          {onDiagnostics}
        />
      {/key}
    {:else}
      <p data-canvas-agent-loading="">Loading the player…</p>
    {/if}
  </div>
</div>

<style>
  .agent-canvas {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .agent-canvas__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .agent-canvas__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .agent-canvas__button[aria-pressed='true'] {
    border-color: var(--tx-primary, Highlight);
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    font-weight: 600;
  }
  .agent-canvas__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .agent-canvas__status p {
    margin: 0;
    font-size: 0.875rem;
  }
  .agent-canvas__refused {
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--tx-danger, CanvasText);
    border-radius: 0.4rem;
    background: var(--tx-danger-soft, Canvas);
    color: var(--tx-danger-soft-foreground, CanvasText);
    overflow-wrap: anywhere;
  }
  .agent-canvas__stage {
    min-block-size: 18rem;
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  /* The player's diagnostics quote refused values verbatim; long ones wrap here. */
  .agent-canvas__stage :global(.tx-player__notice) {
    overflow-wrap: anywhere;
  }
  @media (forced-colors: active) {
    .agent-canvas__button[aria-pressed='true'] {
      border-color: Highlight;
    }
  }
</style>
