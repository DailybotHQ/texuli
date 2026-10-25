<script lang="ts">
import type { Component } from 'svelte';
import BehaviorFrame from '../../behavior/harness/client/BehaviorFrame.svelte';
import { listScenarios, scenarioLoader } from './registry.ts';

/**
 * `?behavior=<primitive>`: renders one scenario component inside the shared
 * frame. `html[data-behavior-ready]` tells the harness the scenario has
 * mounted; `data-behavior-error` that it could not.
 */
let { primitive }: { primitive: string } = $props();

let Scenario: Component | null = $state(null);
let error: string | null = $state(null);

$effect(() => {
  const root = document.documentElement;
  const load = scenarioLoader(primitive);
  if (!load) {
    error = `No behavior scenario "${primitive}". Known: ${listScenarios().join(', ')}`;
    root.dataset.behaviorError = 'true';
    return;
  }
  let cancelled = false;
  load().then(
    (module) => {
      if (cancelled) return;
      Scenario = module.default;
      requestAnimationFrame(() => {
        if (!cancelled) root.dataset.behaviorReady = 'true';
      });
    },
    (reason: unknown) => {
      if (cancelled) return;
      error = reason instanceof Error ? reason.message : 'The scenario failed to load.';
      root.dataset.behaviorError = 'true';
    }
  );
  return () => {
    cancelled = true;
  };
});
</script>

<main data-behavior-scenario={primitive}>
  {#if error}
    <p role="alert">{error}</p>
  {:else if Scenario}
    <BehaviorFrame>
      <Scenario />
    </BehaviorFrame>
  {:else}
    <p role="status">Loading scenario…</p>
  {/if}
</main>
