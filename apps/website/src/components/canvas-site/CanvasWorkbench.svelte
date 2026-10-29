<script lang="ts">
/**
 * /canvas-page/ workbench: the full `CanvasEditor` (tools toolbar, the
 * `role="application"` surface with snapping guides and a minimap, and the
 * shape tree for screen readers) on a board that holds one shape of every
 * type and connectors with every routing. The editor loads after the
 * island hydrates. The editor's own toolbar holds the tools, undo, redo
 * and zoom; the bar here reads its controller (shapes, selection, zoom),
 * resets the board, and exports it as SVG or PNG in the browser.
 */
import type { CanvasDocument } from '@texuli/canvas/model';
import { onMount } from 'svelte';
import { launchBoard } from './board.ts';
import { byteSize, saveBlob } from './download.ts';

type EditorModule = typeof import('@texuli/canvas/editor');
type Controller = import('@texuli/canvas/editor').CanvasController;

let editor = $state.raw<EditorModule | null>(null);
let controller = $state<Controller | undefined>(undefined);
let canvas = $state.raw<CanvasDocument>(launchBoard());
let round = $state(0);
let failed = $state(false);
let exportStatus = $state('');

const selected = $derived(controller ? controller.selection.size : 0);
const zoom = $derived(controller ? Math.round(controller.view.zoom * 100) : 100);
const counts = $derived({
  shapes: countShapes(canvas.shapes),
  connectors: canvas.connectors?.length ?? 0,
});

function countShapes(shapes: CanvasDocument['shapes']): number {
  let total = 0;
  for (const shape of shapes) {
    total += 1;
    if ('children' in shape) total += countShapes(shape.children);
  }
  return total;
}

onMount(() => {
  let live = true;
  import('@texuli/canvas/editor').then(
    (module) => {
      if (live) editor = module;
    },
    () => {
      failed = true;
    }
  );
  return () => {
    live = false;
  };
});

function reset(): void {
  canvas = launchBoard();
  round += 1;
  exportStatus = '';
}

async function exportAs(format: 'svg' | 'png'): Promise<void> {
  exportStatus = `Writing ${format.toUpperCase()}…`;
  try {
    const { canvasToPng, canvasToSvg } = await import('@texuli/canvas/export');
    const blob =
      format === 'svg'
        ? new Blob([canvasToSvg(canvas)], { type: 'image/svg+xml' })
        : await canvasToPng(canvas, { scale: 2 });
    saveBlob(blob, `launch-plan.${format}`);
    exportStatus = `Saved launch-plan.${format} (${byteSize(blob.size)}).`;
  } catch {
    exportStatus = 'The export failed. Nothing was saved.';
  }
}
</script>

<div class="workbench" data-canvas-workbench="">
  <div class="workbench__bar">
    <div class="workbench__group" role="group" aria-label="The board">
      <button type="button" class="workbench__button" onclick={reset}>Reset the board</button>
    </div>
    <div class="workbench__group" role="group" aria-label="Export the board">
      <button type="button" class="workbench__button" onclick={() => exportAs('svg')}>Export SVG</button>
      <button type="button" class="workbench__button" onclick={() => exportAs('png')}>Export PNG</button>
    </div>
  </div>
  <p class="workbench__facts" data-canvas-facts="">
    <span data-canvas-count="shapes">{counts.shapes} shapes</span>
    <span data-canvas-count="connectors">{counts.connectors} connectors</span>
    <span data-canvas-selected="">{selected} selected</span>
    <span data-canvas-zoom="">Zoom {zoom}%</span>
  </p>
  <p class="workbench__status" role="status" data-canvas-export-status="">{exportStatus}</p>
  <div class="workbench__stage" data-canvas-stage="">
    {#if failed}
      <p role="alert">The canvas editor could not load. Reload the page to try again.</p>
    {:else if editor}
      {#key round}
        <editor.CanvasEditor bind:canvas bind:controller />
      {/key}
    {:else}
      <p data-canvas-loading="">Loading the canvas editor…</p>
    {/if}
  </div>
</div>

<style>
  .workbench {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
    min-inline-size: 0;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 1rem;
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .workbench__bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem 1rem;
  }
  .workbench__group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .workbench__button {
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .workbench__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .workbench__button[aria-disabled='true'] {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .workbench__facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    font-size: 0.8125rem;
  }
  .workbench__facts span {
    padding: 0.1rem 0.55rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 999px;
    font-variant-numeric: tabular-nums;
  }
  .workbench__status {
    margin: 0;
    min-block-size: 1.25rem;
    font-size: 0.875rem;
  }
  .workbench__stage {
    min-block-size: 34rem;
    min-inline-size: 0;
  }
  .workbench__stage :global(.tx-canvas-editor) {
    min-block-size: 34rem;
  }
  @media (forced-colors: active) {
    .workbench__button[aria-disabled='true'] {
      color: GrayText;
    }
  }
</style>
