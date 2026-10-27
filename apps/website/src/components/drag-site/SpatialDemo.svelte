<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import { type Point, rectFromPoints } from '@texuli/drag';
import { bindPointerGesture, createPointerTracker } from '@texuli/drag/gesture';
import {
  boundsOf,
  fitView,
  type Guide,
  marqueeSelect,
  moveFree,
  type Placed,
  panBy,
  screenToWorld,
  snapToGuides,
  snapValue,
  type ViewTransform,
  zoomAt,
} from '@texuli/drag/spatial';
import type { Attachment } from 'svelte/attachments';

/**
 * Free placement on a canvas with @texuli/drag/spatial and /gesture: drag
 * cards (the selection moves together), pan the background, Shift+drag a
 * marquee, zoom around the pointer or the center, snap to a grid or to the
 * edges of other cards (guides). Keyboard: Tab to a card, arrows nudge one
 * grid step (Shift: four), Space toggles selection; the buttons zoom and fit.
 */

const GRID = 16;
const LIMITS = { min: 0.4, max: 2.5 };

let cards = $state.raw<readonly (Placed & { label: string })[]>([
  { id: 'idea', label: 'Idea', rect: { x: 32, y: 32, width: 160, height: 72 } },
  { id: 'draft', label: 'Draft', rect: { x: 256, y: 48, width: 160, height: 72 } },
  { id: 'review', label: 'Review', rect: { x: 128, y: 176, width: 160, height: 72 } },
  { id: 'ship', label: 'Ship', rect: { x: 352, y: 208, width: 160, height: 72 } },
]);
let view = $state.raw<ViewTransform>({ x: 0, y: 0, zoom: 1 });
let selected = $state.raw<ReadonlySet<string>>(new Set());
let snap = $state<'grid' | 'guides' | 'off'>('grid');
let guides = $state.raw<readonly Guide[]>([]);
let marquee = $state.raw<{ from: Point; to: Point } | null>(null);
let viewport = $state<HTMLElement | null>(null);

function say(message: string): void {
  if (viewport) getAnnouncer(viewport.ownerDocument).announce(message, 'polite');
}

function local(point: Point): Point {
  const box = viewport?.getBoundingClientRect();
  return box ? { x: point.x - box.left, y: point.y - box.top } : point;
}

function place(moved: readonly Placed[]): void {
  const byId = new Map(moved.map((entry) => [entry.id, entry.rect]));
  cards = cards.map((card) => {
    const rect = byId.get(card.id);
    return rect ? { ...card, rect } : card;
  });
}

/** Snap a moved group by its first card: to the grid, or to the other cards' edges. */
function snapped(moved: readonly Placed[]): readonly Placed[] {
  const lead = moved[0];
  if (!lead || snap === 'off') {
    guides = [];
    return moved;
  }
  let dx = 0;
  let dy = 0;
  if (snap === 'grid') {
    dx = snapValue(lead.rect.x, GRID) - lead.rect.x;
    dy = snapValue(lead.rect.y, GRID) - lead.rect.y;
    guides = [];
  } else {
    const ids = new Set(moved.map((entry) => entry.id));
    const others = cards.filter((card) => !ids.has(card.id));
    const result = snapToGuides(lead.rect, others, 8 / view.zoom);
    dx = result.offset.x;
    dy = result.offset.y;
    guides = result.guides;
  }
  return moved.map(({ id, rect }) => ({ id, rect: { ...rect, x: rect.x + dx, y: rect.y + dy } }));
}

function nameOf(id: string): string {
  return cards.find((card) => card.id === id)?.label ?? id;
}

function where(id: string): string {
  const rect = cards.find((card) => card.id === id)?.rect;
  return rect ? `x ${Math.round(rect.x)}, y ${Math.round(rect.y)}` : '';
}

/** Drag a card (and the rest of the selection with it). */
function cardDrag(id: string): Attachment<HTMLElement> {
  return (node) => {
    let start: readonly Placed[] = [];
    return bindPointerGesture(
      node,
      createPointerTracker({
        onStart: () => {
          const ids = selected.has(id) ? selected : new Set([id]);
          start = cards
            .filter((card) => ids.has(card.id))
            .map(({ id: key, rect }) => ({ id: key, rect }));
        },
        onMove: (event) => place(snapped(moveFree(start, event.delta, view))),
        onEnd: () => {
          guides = [];
          say(`${nameOf(id)} placed at ${where(id)}.`);
        },
        onCancel: () => {
          place(start);
          guides = [];
          say(`Move cancelled. ${nameOf(id)} is back.`);
        },
      })
    );
  };
}

/** The background: drag to pan, Shift+drag to select with a marquee. */
const background: Attachment<HTMLElement> = (node) => {
  let selecting = false;
  // Read at drag start only: the attachment must not track the view.
  let startView: ViewTransform | null = null;
  return bindPointerGesture(
    node,
    createPointerTracker({
      onStart: (event) => {
        startView = view;
        if (selecting) marquee = { from: local(event.origin), to: local(event.point) };
      },
      onMove: (event) => {
        if (selecting) marquee = marquee ? { ...marquee, to: local(event.point) } : null;
        else if (startView) view = panBy(startView, event.delta);
      },
      onEnd: () => {
        if (!selecting || !marquee) return;
        const from = screenToWorld(marquee.from, view);
        const to = screenToWorld(marquee.to, view);
        selected = new Set(marqueeSelect(from, to, cards));
        marquee = null;
        say(`${selected.size} card${selected.size === 1 ? '' : 's'} selected.`);
      },
      onClick: () => {
        selected = new Set();
      },
      onCancel: () => {
        marquee = null;
      },
    }),
    {
      accept: (event) => {
        if (event.target !== node && !(event.target instanceof SVGElement)) return false;
        selecting = (event as PointerEvent).shiftKey;
        return true;
      },
    }
  );
};

function zoom(factor: number, anchor?: Point): void {
  const box = viewport?.getBoundingClientRect();
  const at = anchor ?? { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 };
  view = zoomAt(view, at, factor, LIMITS);
}

function fit(): void {
  const box = viewport?.getBoundingClientRect();
  if (!box) return;
  view = fitView(boundsOf(cards.map((card) => card.rect)), box, 32, LIMITS);
}

function onWheel(event: WheelEvent): void {
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1, local({ x: event.clientX, y: event.clientY }));
}

function onCardKey(event: KeyboardEvent, id: string): void {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
    say(`${nameOf(id)} ${next.has(id) ? 'selected' : 'not selected'}.`);
    return;
  }
  const step = event.shiftKey ? GRID * 4 : GRID;
  const delta =
    event.key === 'ArrowLeft'
      ? { x: -step, y: 0 }
      : event.key === 'ArrowRight'
        ? { x: step, y: 0 }
        : event.key === 'ArrowUp'
          ? { x: 0, y: -step }
          : event.key === 'ArrowDown'
            ? { x: 0, y: step }
            : null;
  if (!delta) return;
  event.preventDefault();
  const ids = selected.has(id) ? selected : new Set([id]);
  const moving = cards
    .filter((card) => ids.has(card.id))
    .map(({ id: key, rect }) => ({ id: key, rect }));
  place(moveFree(moving, { x: delta.x * view.zoom, y: delta.y * view.zoom }, view));
  say(`${nameOf(id)} at ${where(id)}.`);
}

const marqueeBox = $derived(marquee ? rectFromPoints(marquee.from, marquee.to) : null);
</script>

<div class="spatial">
  <div class="spatial__tools" role="toolbar" aria-label="Canvas tools">
    <button type="button" onclick={() => zoom(1.2)}>Zoom in</button>
    <button type="button" onclick={() => zoom(1 / 1.2)}>Zoom out</button>
    <button type="button" onclick={fit}>Fit</button>
    <label>
      Snap
      <select bind:value={snap}>
        <option value="grid">To the grid</option>
        <option value="guides">To other cards</option>
        <option value="off">Off</option>
      </select>
    </label>
    <span class="spatial__zoom" aria-live="off">{Math.round(view.zoom * 100)}%</span>
  </div>
  <p class="spatial__hint">
    Drag cards; drag the background to pan, Shift+drag to select. Keyboard: Tab to a card, arrows
    nudge it (Shift for bigger steps), Space selects. Ctrl or Command with the wheel zooms.
  </p>
  <div
    class="spatial__viewport"
    bind:this={viewport}
    role="group"
    aria-label="Planning canvas"
    data-spatial-canvas
    onwheel={onWheel}
    {@attach background}
  >
    <svg class="spatial__grid" aria-hidden="true">
      <defs>
        <pattern
          id="spatial-dots"
          width={GRID * view.zoom}
          height={GRID * view.zoom}
          x={view.x}
          y={view.y}
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#spatial-dots)" />
      {#each guides as guide (`${guide.axis}:${guide.position}`)}
        {#if guide.axis === 'x'}
          <line class="spatial__guide" x1={guide.position * view.zoom + view.x} x2={guide.position * view.zoom + view.x} y1="0" y2="100%" />
        {:else}
          <line class="spatial__guide" y1={guide.position * view.zoom + view.y} y2={guide.position * view.zoom + view.y} x1="0" x2="100%" />
        {/if}
      {/each}
    </svg>
    <div class="spatial__layer" style:transform={`translate(${view.x}px, ${view.y}px) scale(${view.zoom})`}>
      {#each cards as card (card.id)}
        <button
          type="button"
          class="spatial__card"
          aria-pressed={selected.has(card.id)}
          aria-label={`${card.label}, ${Math.round(card.rect.x)}, ${Math.round(card.rect.y)}`}
          style:transform={`translate(${card.rect.x}px, ${card.rect.y}px)`}
          style:inline-size={`${card.rect.width}px`}
          style:block-size={`${card.rect.height}px`}
          onkeydown={(event) => onCardKey(event, card.id)}
          {@attach cardDrag(card.id)}
        >
          {card.label}
        </button>
      {/each}
    </div>
    {#if marqueeBox}
      <div
        class="spatial__marquee"
        aria-hidden="true"
        style:transform={`translate(${marqueeBox.x}px, ${marqueeBox.y}px)`}
        style:inline-size={`${marqueeBox.width}px`}
        style:block-size={`${marqueeBox.height}px`}
      ></div>
    {/if}
  </div>
</div>

<style>
  .spatial {
    display: grid;
    gap: 0.6rem;
  }
  .spatial__tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .spatial__tools button,
  .spatial__tools select {
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-surface, ButtonFace);
    color: inherit;
    font: inherit;
  }
  .spatial__tools label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .spatial__zoom,
  .spatial__hint {
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .spatial__hint {
    margin: 0;
  }
  .spatial__viewport {
    position: relative;
    overflow: hidden;
    block-size: 22rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.75rem;
    background: var(--tx-muted, Canvas);
    touch-action: none;
    cursor: grab;
  }
  .spatial__grid {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    fill: var(--tx-border, GrayText);
  }
  .spatial__guide {
    stroke: var(--tx-primary, Highlight);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }
  .spatial__layer {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    transform-origin: 0 0;
  }
  .spatial__card {
    position: absolute;
    inset-block-start: 0;
    left: 0;
    display: grid;
    place-items: center;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.75rem;
    background: var(--tx-surface, ButtonFace);
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: grab;
    touch-action: none;
  }
  .spatial__card[aria-pressed='true'] {
    outline: 2px solid var(--tx-primary, Highlight);
    outline-offset: 2px;
  }
  .spatial__card:focus-visible {
    outline: 3px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .spatial__marquee {
    position: absolute;
    inset-block-start: 0;
    left: 0;
    border: 1px dashed var(--tx-primary, Highlight);
    background: color-mix(in oklch, var(--tx-primary, Highlight) 12%, transparent);
    pointer-events: none;
  }
  @media (forced-colors: active) {
    .spatial__guide {
      stroke: Highlight;
    }
    .spatial__card[aria-pressed='true'] {
      outline-color: Highlight;
    }
  }
</style>
