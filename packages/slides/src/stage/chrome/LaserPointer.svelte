<script lang="ts">
/**
 * The laser pointer (L): a bright dot that replaces the cursor over the
 * slides. It shows at once, at the last pointer position over the stage or
 * in the middle of the slides, so turning it on never looks like nothing
 * happened; a "Laser on" chip says it is on. A touch moves the dot to each
 * tap and leaves it there; a mouse or pen leaving the stage hides it. It is
 * decoration (`aria-hidden`), never takes pointer events, and only glides
 * when motion is allowed. Loaded on its own chunk.
 */
import { untrack } from 'svelte';

interface Props {
  /** The stage root: the dot follows the pointer over it. */
  root: HTMLElement;
  label: string;
  /** Client coordinates of the last pointer position over the stage. */
  start?: { x: number; y: number } | null;
}

let { root, label, start = null }: Props = $props();
let point = $state.raw<{ x: number; y: number } | null>(null);

$effect(() => {
  const host = root;
  const viewport = host.querySelector<HTMLElement>('.tx-deck-stage__viewport');
  const box = host.getBoundingClientRect();
  const inside = (x: number, y: number) =>
    x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  const from = untrack(() => start);
  const center = viewport?.getBoundingClientRect() ?? box;
  point =
    from && inside(from.x, from.y)
      ? { x: from.x - box.left, y: from.y - box.top }
      : {
          x: center.left + center.width / 2 - box.left,
          y: center.top + center.height / 2 - box.top,
        };
  const move = (event: PointerEvent) => {
    const at = host.getBoundingClientRect();
    point = { x: event.clientX - at.left, y: event.clientY - at.top };
  };
  const leave = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') point = null;
  };
  // The dot replaces the cursor over the slides (CSSOM, restored on exit).
  const cursor = viewport?.style.cursor ?? '';
  if (viewport) viewport.style.cursor = 'none';
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerdown', move);
  host.addEventListener('pointerleave', leave);
  return () => {
    if (viewport) viewport.style.cursor = cursor;
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerdown', move);
    host.removeEventListener('pointerleave', leave);
  };
});
</script>

<div class="tx-deck-chrome-laser" aria-hidden="true" data-tx-deck-laser>
  <span class="tx-deck-chrome-laser__chip">{label}</span>
  {#if point}
    <span
      class="tx-deck-chrome-laser__dot"
      style:transform={`translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`}
    ></span>
  {/if}
</div>

<style>
  .tx-deck-chrome-laser {
    position: absolute;
    z-index: 15;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .tx-deck-chrome-laser__chip {
    position: absolute;
    inset-block-end: 0.75rem;
    inset-inline-start: 0.75rem;
    padding-block: 0.25rem;
    padding-inline: 0.625rem;
    color: #fff;
    background: #b91c1c;
    border-radius: 999px;
    font-size: var(--tx-font-size-xs, 0.75rem);
    font-weight: 600;
  }

  /* Physical top/left: the dot follows pointer coordinates, whatever the writing direction. */
  .tx-deck-chrome-laser__dot {
    position: absolute;
    top: -0.5rem;
    left: -0.5rem;
    inline-size: 1rem;
    block-size: 1rem;
    background: #ef4444;
    border-radius: 50%;
    box-shadow:
      0 0 0 2px rgb(255 255 255 / 0.8),
      0 0 12px 4px rgb(239 68 68 / 0.65);
  }

  @media (prefers-reduced-motion: no-preference) {
    .tx-deck-chrome-laser__dot {
      transition: transform 40ms linear;
    }
  }

  :global(.tx-deck-stage[data-motion="reduce"]) .tx-deck-chrome-laser__dot {
    transition: none;
  }

  @media (forced-colors: active) {
    .tx-deck-chrome-laser__chip,
    .tx-deck-chrome-laser__dot {
      forced-color-adjust: none;
    }
  }
</style>
