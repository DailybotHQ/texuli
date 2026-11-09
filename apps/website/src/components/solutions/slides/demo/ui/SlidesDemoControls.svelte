<script lang="ts">
import type { SlidesDemoAction, SlidesDemoSnapshot } from '../model.ts';
import { SLIDES_DEMO_SCENARIOS, type SlidesDemoScenarioId } from '../model.ts';

type Props = {
  snapshot: SlidesDemoSnapshot;
  announcement: string;
  onAction: (action: SlidesDemoAction) => void;
};

let { snapshot, announcement, onAction }: Props = $props();

function selectScenario(event: Event): void {
  const id = (event.currentTarget as HTMLSelectElement).value as SlidesDemoScenarioId;
  onAction({ type: 'scenario', id });
}

const themeName = (theme: SlidesDemoSnapshot['theme']): string =>
  typeof theme === 'string' ? theme : 'custom';
</script>

<div class="controls" role="group" aria-label="Slide deck controls">
  <label class="controls__scenario">
    <span>Scenario</span>
    <select value={snapshot.scenarioId} onchange={selectScenario}>
      {#each SLIDES_DEMO_SCENARIOS as scenario (scenario.id)}
        <option value={scenario.id}>{scenario.label}</option>
      {/each}
    </select>
  </label>

  <button type="button" onclick={() => onAction({ type: 'prev' })} disabled={snapshot.slideNumber <= 1}>
    Previous slide
  </button>
  <button type="button" onclick={() => onAction({ type: 'next' })} disabled={snapshot.slideNumber >= snapshot.slideCount}>
    Next slide
  </button>
  <button type="button" aria-pressed={snapshot.playing} onclick={() => onAction({ type: 'play' })}>
    {snapshot.playing ? 'Pause slides' : 'Play slides'}
  </button>
  <button type="button" onclick={() => onAction({ type: 'theme' })}>
    Theme: {themeName(snapshot.theme)}
  </button>
  <button type="button" aria-pressed={snapshot.sourceVisible} onclick={() => onAction({ type: 'view-source' })}>
    {snapshot.sourceVisible ? 'Hide source' : 'View source'}
  </button>
  <button type="button" onclick={() => onAction({ type: 'reset' })}>Reset example</button>
</div>

<p class="controls__position" aria-live="polite" aria-atomic="true" role="status">
  Slide {snapshot.slideNumber} of {snapshot.slideCount}: {announcement}
</p>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.65rem;
  }

  button,
  select {
    min-block-size: 2.75rem;
    max-inline-size: 100%;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--tx-border, GrayText);
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  button:focus-visible,
  select:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }

  .controls__scenario {
    display: grid;
    gap: 0.25rem;
    font-size: 0.875rem;
  }

  .controls__position {
    min-block-size: 1.5em;
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }

  @media (forced-colors: active) {
    button,
    select {
      border-color: ButtonText;
    }
  }
</style>
