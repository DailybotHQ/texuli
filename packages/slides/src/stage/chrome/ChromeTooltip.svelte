<script lang="ts">
/**
 * The toolbar's one tooltip (`createDeckTooltip`): the label, description
 * and shortcut of the button it shows for, as text. Fixed-positioned below
 * the button (above when there is no room), kept in the viewport, never
 * takes the pointer, hidden in print.
 */
import { tick } from 'svelte';
import { type DeckTooltip, type DeckTooltipView, placeDeckTooltip } from './tooltip.ts';

let { tooltip }: { tooltip: DeckTooltip } = $props();

let view = $state.raw<DeckTooltipView | null>(null);
let node = $state<HTMLDivElement | undefined>();
let position = $state.raw<{ x: number; y: number } | null>(null);

$effect(() => tooltip.subscribe((next) => (view = next)));

$effect(() => {
  const current = view;
  const element = node;
  position = null;
  if (!current || !element) return;
  void tick().then(() => {
    const doc = element.ownerDocument;
    position = placeDeckTooltip(
      current.anchor.getBoundingClientRect(),
      element.getBoundingClientRect(),
      {
        width: doc.documentElement.clientWidth || window.innerWidth,
        height: doc.documentElement.clientHeight || window.innerHeight,
      }
    );
  });
});
</script>

{#if view}
  <div
    bind:this={node}
    id={tooltip.id}
    role="tooltip"
    class="tx-deck-chrome-tooltip"
    data-placed={position ? 'true' : 'false'}
    style:transform={position
      ? `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px)`
      : undefined}
  >
    <span class="tx-deck-chrome-tooltip__title">{view.content.title}</span>
    <span class="tx-deck-chrome-tooltip__text">{view.content.description}</span>
    {#if view.content.shortcut}
      <span class="tx-deck-chrome-tooltip__keys">{view.content.shortcut}</span>
    {/if}
  </div>
{/if}

<style>
  .tx-deck-chrome-tooltip {
    position: fixed;
    z-index: 40;
    top: 0;
    left: 0;
    display: grid;
    gap: 0.125rem;
    box-sizing: border-box;
    max-inline-size: min(18rem, calc(100vw - 1rem));
    padding-block: 0.5rem;
    padding-inline: 0.75rem;
    color: var(--tx-foreground);
    background: var(--tx-elevated, var(--tx-surface, var(--tx-background)));
    border: 1px solid var(--tx-border-strong, var(--tx-border));
    border-radius: var(--tx-radius, 0.5rem);
    box-shadow: var(--tx-shadow-float, 0 4px 16px rgb(0 0 0 / 0.16));
    font-size: 0.8125rem;
    line-height: 1.35;
    text-align: start;
    pointer-events: none;
  }

  .tx-deck-chrome-tooltip[data-placed="false"] {
    visibility: hidden;
  }

  .tx-deck-chrome-tooltip__title {
    font-weight: 600;
  }

  .tx-deck-chrome-tooltip__text {
    color: var(--tx-muted-foreground, inherit);
  }

  .tx-deck-chrome-tooltip__keys {
    font-weight: 500;
  }

  @media print {
    .tx-deck-chrome-tooltip {
      display: none;
    }
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-tooltip {
      border-color: CanvasText;
    }
  }
</style>
