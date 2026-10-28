<script lang="ts">
import {
  capturePointer,
  createPointerTracker,
  type GestureElement,
  type PointerTracker,
} from '@texuli/drag/gesture';
import { screenToWorld } from '@texuli/drag/spatial';
import type { WorkflowController } from './controller.svelte.ts';
import { formatLabel } from './labels.ts';

/**
 * The registry's node types. Activating one adds it at the center of the
 * view (the keyboard path); dragging one onto the canvas drops it there.
 */
let { controller, types }: { controller: WorkflowController; types?: readonly string[] } = $props();

const entries = $derived(
  (types ?? controller.registry.types).flatMap((type) => {
    const spec = controller.registry.get(type);
    return spec ? [spec] : [];
  })
);
const categories = $derived([...new Set(entries.map((spec) => spec.category ?? ''))]);

let tracker: PointerTracker | null = null;
let ghost = $state<{ type: string; label: string; x: number; y: number } | null>(null);
let dragged = false;

function onPointerDown(event: PointerEvent, type: string, label: string): void {
  if (controller.readonly || tracker) return;
  const element = event.currentTarget as HTMLElement;
  dragged = false;
  const created = createPointerTracker({
    threshold: 6,
    onStart(e) {
      dragged = true;
      ghost = { type, label, x: e.point.x, y: e.point.y };
    },
    onMove(e) {
      if (ghost) ghost = { ...ghost, x: e.point.x, y: e.point.y };
    },
    onEnd(e) {
      ghost = null;
      tracker = null;
      const viewport = controller.viewportElement;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const inside =
        e.point.x >= rect.left &&
        e.point.x <= rect.right &&
        e.point.y >= rect.top &&
        e.point.y <= rect.bottom;
      if (inside)
        controller.addNode(
          type,
          screenToWorld({ x: e.point.x - rect.left, y: e.point.y - rect.top }, controller.view)
        );
    },
    onCancel() {
      ghost = null;
      tracker = null;
    },
    onClick() {
      tracker = null;
    },
  });
  if (!created.down(event)) return;
  tracker = created;
  capturePointer(element as unknown as GestureElement, event.pointerId);
}
</script>

<div class="tx-workflow-palette" role="group" aria-label={formatLabel(controller.labels.palette)}>
  {#each categories as category (category)}
    <ul class="tx-workflow-palette__list" aria-label={category || undefined}>
      {#each entries.filter((spec) => (spec.category ?? '') === category) as spec (spec.type)}
        <li>
          <button
            type="button"
            class="tx-workflow-palette__item"
            data-category={spec.category}
            aria-disabled={controller.readonly || undefined}
            aria-label={formatLabel(controller.labels.addNode, { type: spec.label })}
            title={spec.description}
            onpointerdown={(event) => onPointerDown(event, spec.type, spec.label)}
            onpointermove={(event) => tracker?.move(event)}
            onpointerup={(event) => tracker?.up(event)}
            onpointercancel={(event) => tracker?.cancel(event)}
            onkeydown={(event) => {
              if (event.key === 'Escape' && tracker) tracker.cancel();
            }}
            onclick={() => {
              if (dragged || controller.readonly) {
                dragged = false;
                return;
              }
              controller.addNode(spec.type);
            }}>{spec.label}</button
          >
        </li>
      {/each}
    </ul>
  {/each}
</div>
{#if ghost}
  <div class="tx-workflow-palette__ghost" aria-hidden="true" style:left={`${ghost.x}px`} style:top={`${ghost.y}px`}>
    {ghost.label}
  </div>
{/if}

<style>
  @layer tx.components {
    .tx-workflow-palette {
      display: grid;
      gap: 0.5rem;
      align-content: start;
    }

    .tx-workflow-palette__list {
      display: grid;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tx-workflow-palette__item {
      inline-size: 100%;
      min-block-size: 2rem;
      padding: 0.25rem 0.75rem;
      font: inherit;
      text-align: start;
      color: inherit;
      background: var(--tx-surface, ButtonFace);
      border: 1px solid var(--tx-border, ButtonText);
      border-inline-start: 4px solid var(--tx-workflow-accent, var(--tx-primary, ButtonText));
      border-radius: var(--tx-radius-md, 0.5rem);
      cursor: grab;
      touch-action: none;
    }

    .tx-workflow-palette__item:focus-visible {
      outline: 3px solid var(--tx-ring, Highlight);
      outline-offset: 2px;
    }

    .tx-workflow-palette__item[aria-disabled='true'] {
      cursor: not-allowed;
      opacity: 0.5;
    }

    /* The ghost follows the pointer in viewport coordinates, so it is placed physically. */
    .tx-workflow-palette__ghost {
      position: fixed;
      z-index: 10;
      padding: 0.25rem 0.75rem;
      background: var(--tx-surface, Canvas);
      border: 1px solid var(--tx-primary, Highlight);
      border-radius: var(--tx-radius-md, 0.5rem);
      pointer-events: none;
      transform: translate(-50%, -50%);
    }
  }
</style>
