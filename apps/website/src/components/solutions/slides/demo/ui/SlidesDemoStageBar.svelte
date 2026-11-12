<script lang="ts">
/**
 * The demo stage's own small bar, under the slide at the inline start: previous, position,
 * next and full screen. It renders inside the stage (the `chrome` snippet), so it drives the
 * stage through `getDeckStageContext()`, and the demo follows through `onSlideChange`.
 *
 * It also makes the first click on the slide advance it. An embedded stage spends the first
 * click on focus; a capture-phase pointerdown focuses the active slide first, so the stage
 * sees a focused deck and handles the click as navigation.
 */
import { getDeckStageContext } from '@texuli/slides/stage-core';
import { onMount } from 'svelte';

const stage = getDeckStageContext();
let bar: HTMLElement | undefined = $state();

const count = $derived(stage?.slides.length ?? 0);
const current = $derived((stage?.position ?? 0) + 1);
const fullscreen = $derived(stage ? stage.fullscreen !== 'off' : false);

onMount(() => {
  const root = bar?.closest<HTMLElement>('.tx-deck-stage');
  const canvas = root?.querySelector<HTMLElement>('.tx-deck-stage__viewport');
  if (!root || !canvas || !stage) return;
  const focusFirst = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const active = document.activeElement;
    if (active && root.contains(active)) return;
    stage.focusSlide();
  };
  canvas.addEventListener('pointerdown', focusFirst, { capture: true });
  return () => canvas.removeEventListener('pointerdown', focusFirst, { capture: true });
});
</script>

{#if stage}
  <!-- The chrome row stretches its children; this row takes the stretch, the bar stays compact. -->
  <div class="stage-bar-row" bind:this={bar}>
  <div class="stage-bar" role="group" aria-label="Slide navigation">
    <button
      type="button"
      class="stage-bar__button"
      aria-label="Previous slide"
      disabled={current <= 1}
      onclick={() => stage.prev()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
    </button>
    <span class="stage-bar__position" aria-hidden="true">{current} / {count}</span>
    <button
      type="button"
      class="stage-bar__button"
      aria-label="Next slide"
      disabled={current >= count}
      onclick={() => stage.next()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
    </button>
    <span class="stage-bar__divider" aria-hidden="true"></span>
    <button
      type="button"
      class="stage-bar__button"
      aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
      aria-pressed={fullscreen}
      onclick={() => stage.toggleFullscreen()}
    >
      {#if fullscreen}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
      {/if}
    </button>
  </div>
  </div>
{/if}

<style>
  /*
   * Full screen: the stage shows its own overlay (leave, previous, position, next), so this
   * bar (a direct row of the stage root) steps aside and the slide row takes the screen, as
   * the stage does for its default toolbar.
   */
  :global(.tx-deck-stage[data-fullscreen]) > .stage-bar-row {
    display: none;
  }

  .stage-bar-row {
    display: flex;
    justify-content: flex-start;
    min-inline-size: 0;
  }

  .stage-bar {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.25rem;
    justify-self: start;
    padding: 0.25rem;
    border: 1px solid var(--tx-border, GrayText);
    border-radius: 999px;
    background: var(--tx-surface, Canvas);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
  }

  .stage-bar__button {
    display: inline-grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    padding: 0;
    border: 0;
    border-radius: 999px;
    color: var(--tx-foreground, CanvasText);
    background: transparent;
    cursor: pointer;
  }

  .stage-bar__button:hover:not(:disabled) {
    background: var(--tx-muted, ButtonFace);
  }

  .stage-bar__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 1px;
  }

  .stage-bar__button:disabled {
    cursor: default;
    opacity: 0.4;
  }

  .stage-bar__button svg {
    inline-size: 1.15rem;
    block-size: 1.15rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .stage-bar__position {
    min-inline-size: 3.25rem;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .stage-bar__divider {
    inline-size: 1px;
    block-size: 1.25rem;
    margin-inline: 0.15rem;
    background: var(--tx-border, GrayText);
  }

  @media (forced-colors: active) {
    .stage-bar {
      border-color: CanvasText;
    }
    .stage-bar__button:disabled {
      opacity: 1;
      color: GrayText;
    }
  }
</style>
