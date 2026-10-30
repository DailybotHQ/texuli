<script lang="ts">
/**
 * /dashboards-page/ dashboards as agent data: the real `<Player>` at the
 * untrusted tier paints the agent's `data-dashboard` (spec 0.8.0). The
 * grid widget reads the host's `tickets` source through the registry this
 * island hands the player (`sourceRegistry`), and the dashboard's layout
 * is bound to a list state, so a keyboard move shows up in the state
 * snapshot below. "Send the hostile dashboard" swaps in one whose grid
 * names a URL instead of a source: validation refuses it and nothing of
 * it paints. The player loads after hydration.
 */
import { onMount } from 'svelte';
import { AGENT_DASHBOARD_BLUEPRINT, HOSTILE_DASHBOARD_BLUEPRINT } from './blueprint.ts';
import { createDashboardHost } from './sources.ts';

type PlayerModule = typeof import('@texuli/player');
interface DiagnosticsEvent {
  readonly surface?: string;
  readonly error?: string;
  readonly diagnostics: readonly { code: string; severity: string; path?: string }[];
  /** Binding problems (a source named by a URL lands here); non-empty means refused. */
  readonly stateIssues?: readonly { code: string; path?: string }[];
}

const host = createDashboardHost(() => {}, 150);
let player = $state.raw<PlayerModule | null>(null);
let failed = $state(false);
let hostile = $state(false);
let refused = $state.raw<readonly string[]>([]);
let arrangement = $state('');
const blueprint = $derived(hostile ? HOSTILE_DASHBOARD_BLUEPRINT : AGENT_DASHBOARD_BLUEPRINT);

onMount(() => {
  let live = true;
  import('@texuli/player').then(
    (module) => {
      if (live) player = module;
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
  const errors = [
    ...event.diagnostics.filter((entry) => entry.severity === 'error'),
    ...(event.stateIssues ?? []),
  ].map((entry) => `${entry.code}${entry.path ? ` at ${entry.path}` : ''}`);
  if (errors.length === 0 && event.surface === 'notice') errors.push(event.error ?? 'invalid');
  if (errors.length > 0 || hostile) refused = errors;
}

function onStateChange(snapshot: Record<string, unknown>): void {
  const list = snapshot.arrangement;
  arrangement = Array.isArray(list) && list.length > 0 ? JSON.stringify(list) : '';
}

function toggle(next: boolean): void {
  hostile = next;
  refused = [];
  arrangement = '';
}
</script>

<div class="agent-dash" data-dashboards-agent="">
  <div class="agent-dash__bar" role="group" aria-label="Which blueprint the agent sends">
    <button type="button" class="agent-dash__button" aria-pressed={!hostile} onclick={() => toggle(false)}
      >Send the agent’s dashboard</button
    >
    <button type="button" class="agent-dash__button" aria-pressed={hostile} onclick={() => toggle(true)}
      >Send the hostile dashboard</button
    >
  </div>
  <div class="agent-dash__status" role="status" data-dashboards-agent-status="">
    {#if hostile && refused.length > 0}
      <p class="agent-dash__refused" data-dashboards-agent-refused="">
        Refused before painting: {refused.join(', ')}. Nothing of it rendered.
      </p>
    {:else}
      <p>
        Validated at the untrusted tier; the tickets come from the host’s source. Move a widget with
        its handle and the layout is saved in the player’s state.
      </p>
    {/if}
  </div>
  <p class="agent-dash__state" data-dashboards-agent-state="">
    {#if arrangement}Saved in the player’s state: <code>{arrangement}</code>{:else}The player’s
      <code>arrangement</code> state is empty until someone moves a widget.{/if}
  </p>
  <p class="agent-dash__state">
    The frame below is 1,120 pixels wide so the dashboard uses its widest grid, where a change
    persists to the blueprint’s state; on narrower grids the player rearranges in view only. On a
    small screen it scrolls sideways.
  </p>
  <div class="agent-dash__scroller" role="region" aria-label="Agent dashboard frame" tabindex="0">
  <div class="agent-dash__stage" data-dashboards-agent-stage="">
    {#if failed}
      <p role="alert">The player could not load. Reload the page to try again.</p>
    {:else if player}
      {#key hostile}
        <player.Player
          {blueprint}
          tier="untrusted"
          status="draft"
          label="Agent dashboard (untrusted)"
          landmarks={false}
          loadTimeoutMs={8000}
          sourceRegistry={host.registry}
          {onDiagnostics}
          {onStateChange}
        />
      {/key}
    {:else}
      <p data-dashboards-agent-loading="">Loading the player…</p>
    {/if}
  </div>
  </div>
</div>

<style>
  .agent-dash {
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
  .agent-dash__bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .agent-dash__button {
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .agent-dash__button[aria-pressed='true'] {
    border-color: var(--tx-primary, Highlight);
    background: var(--tx-primary-soft, Canvas);
    color: var(--tx-primary-soft-foreground, CanvasText);
    font-weight: 600;
  }
  .agent-dash__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .agent-dash__status p {
    margin: 0;
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }
  .agent-dash__state {
    margin: 0;
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }
  .agent-dash__refused {
    padding: 0.5rem 0.75rem;
    border-inline-start: 4px solid var(--tx-danger, CanvasText);
    border-radius: 0.4rem;
    background: var(--tx-danger-soft, Canvas);
    color: var(--tx-danger-soft-foreground, CanvasText);
  }
  .agent-dash__scroller {
    min-inline-size: 0;
    overflow-x: auto;
  }
  .agent-dash__scroller:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .agent-dash__stage {
    min-block-size: 18rem;
    min-inline-size: 70rem;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  @media (forced-colors: active) {
    .agent-dash__button[aria-pressed='true'] {
      border-color: Highlight;
    }
  }
</style>
