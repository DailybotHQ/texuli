<script lang="ts">
/**
 * /motion-page/ blueprint: the real `<Player>` at the `untrusted` tier
 * paints an agent's blueprint whose motion is data. The toggle inside the
 * blueprint (local state) makes the cards enter, staggered, and leave. The
 * host level and reduced motion come from the page settings. The refused
 * variant paints in `preview`: the node shows, without its motion, and the
 * diagnostic says why.
 */
import { PLAYER_LOADERS, Player, type PlayerDiagnosticsEvent } from '@texuli/player';
import { HOSTILE_BLUEPRINT, MOTION_BLUEPRINT } from './blueprint.ts';
import SettingsNote from './SettingsNote.svelte';
import { MOTION_SETTINGS } from './settings.svelte.ts';

let variant = $state<'motion' | 'hostile'>('motion');
let diagnostics = $state.raw<readonly { code: string; path: string; message: string }[]>([]);

function onDiagnostics(event: PlayerDiagnosticsEvent): void {
  diagnostics = event.diagnostics
    .filter((entry) => entry.severity === 'error')
    .map((entry) => ({ code: entry.code, path: entry.path, message: entry.message }));
}
</script>

<div class="blueprint" data-motion-blueprint="">
  <fieldset class="blueprint__variants">
    <legend>Blueprint</legend>
    <label>
      <input type="radio" name="motion-blueprint" value="motion" bind:group={variant} />
      Motion as data
    </label>
    <label>
      <input type="radio" name="motion-blueprint" value="hostile" bind:group={variant} />
      A motion outside the vocabulary
    </label>
  </fieldset>

  <div class="blueprint__stage" data-motion-blueprint-stage={variant}>
    {#key variant}
      <Player
        blueprint={variant === 'motion' ? MOTION_BLUEPRINT : HOSTILE_BLUEPRINT}
        tier="untrusted"
        status="draft"
        invalidPolicy={variant === 'motion' ? 'refuse' : 'preview'}
        label="Motion blueprint (untrusted)"
        landmarks={false}
        loaders={PLAYER_LOADERS}
        loadTimeoutMs={8000}
        motion={MOTION_SETTINGS.reduced ? 'reduce' : 'auto'}
        motionLevel={MOTION_SETTINGS.level}
        {onDiagnostics}
      />
    {/key}
  </div>

  <div class="blueprint__diagnostics" data-motion-blueprint-diagnostics="">
    {#if diagnostics.length === 0}
      <p>No errors: the motion is inside the vocabulary, so the player plays it.</p>
    {:else}
      <p>Refused, and painted without motion:</p>
      <ul>
        {#each diagnostics as entry (entry.code + entry.path)}
          <li data-code={entry.code}><code>{entry.code}</code> at <code>{entry.path}</code>: {entry.message}</li>
        {/each}
      </ul>
    {/if}
  </div>
  <SettingsNote name="blueprint" />
</div>

<style>
  .blueprint {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.9rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .blueprint__variants {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.25rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .blueprint__variants legend {
    float: inline-start;
    margin-inline-end: 0.5rem;
    padding: 0;
    font-weight: 600;
  }
  .blueprint__variants label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-block-size: 2.25rem;
  }
  .blueprint__variants input {
    accent-color: var(--tx-primary, Highlight);
  }
  .blueprint__stage {
    min-block-size: 16rem;
    min-inline-size: 0;
    padding: 0.75rem;
    border: 1px dashed var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-background, Canvas);
  }
  .blueprint__diagnostics {
    font-size: 0.875rem;
  }
  .blueprint__diagnostics p {
    margin: 0;
  }
  .blueprint__diagnostics ul {
    margin: 0.4rem 0 0;
    padding-inline-start: 1.25rem;
  }
  .blueprint__diagnostics code {
    overflow-wrap: anywhere;
  }
</style>
