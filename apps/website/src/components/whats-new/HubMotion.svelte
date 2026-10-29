<script lang="ts">
/**
 * /whats-new/ motion demo: pick a preset of the closed vocabulary
 * (`MOTION_PRESETS` from `texuli/motion`) and play it on a card through
 * the runtime the components use (`loadMotionRuntime().playPresence`).
 * The runtime loads on first play; with reduced motion the play is
 * instant, as everywhere in Texuli.
 */
import { loadMotionRuntime, MOTION_PRESETS, type MotionPreset } from 'texuli/motion';

let preset = $state<MotionPreset>('rise');
let tile: HTMLElement | undefined = $state();
let outcome = $state('');

async function play(): Promise<void> {
  const runtime = await loadMotionRuntime();
  if (!runtime || !tile) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = runtime.playPresence(tile, 'enter', preset, {
    level: 'full',
    reducedMotion,
    duration: 'slow',
  });
  outcome = reducedMotion ? `${preset}: instant (reduced motion)` : `${preset}: playing`;
  const result = await run.finished;
  outcome = `${preset}: ${reducedMotion ? 'instant (reduced motion)' : `played, ${String(result)}`}`;
}
</script>

<div class="hub-demo" data-hub-demo="motion">
  <div class="hub-demo__row">
    <label class="hub-demo__field">
      <span>Preset</span>
      <select bind:value={preset}>
        {#each MOTION_PRESETS as name (name)}<option value={name}>{name}</option>{/each}
      </select>
    </label>
    <button type="button" class="hub-demo__button" onclick={play}>Play</button>
  </div>
  <div class="hub-demo__tile" bind:this={tile}>Release notes, week 44</div>
  <p class="hub-demo__out" role="status" data-hub-motion-outcome="">{outcome}</p>
</div>
