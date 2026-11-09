<script lang="ts">
import type { CanvasDocument, CanvasShape, CanvasXY } from '@texuli/canvas/model';
import { shapeBounds, shapeName, walkShapes } from '@texuli/canvas/model';
import { CanvasViewer } from '@texuli/canvas/viewer';
import { createCanvasDemoModel } from './model.ts';

const model = createCanvasDemoModel();
let canvas = $state.raw<CanvasDocument>(model.doc);
let selection = $state<string[]>(model.selection);
let additive = $state(false);
let sourceVisible = $state(false);
let announcement = $state('Launch plan canvas loaded. Select a shape or use the canvas controls.');

const shapes = $derived(walkShapes(canvas));
const source = $derived(JSON.stringify(canvas, null, 2));

function sync(message: string): void {
  canvas = model.doc;
  selection = [...model.selection];
  announcement = message;
}

function centerOf(shape: CanvasShape): CanvasXY {
  const bounds = shapeBounds(shape);
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function selectShape(shape: CanvasShape): void {
  const id = model.selectAt(centerOf(shape), additive);
  if (!id) {
    announcement = 'That shape could not be selected.';
    return;
  }
  selection = [...model.selection];
  announcement = `${shapeName(shape) || shape.type} selected${additive ? ' for connection' : ''}.`;
}

function moveSelected(delta: CanvasXY): void {
  if (selection.length === 0) {
    announcement = 'Select a shape before moving it.';
    return;
  }
  if (!model.moveSelection(delta)) {
    announcement = 'The selected shape could not be moved.';
    return;
  }
  sync('Selected shape moved.');
}

function moveWithKey(event: KeyboardEvent, shape: CanvasShape): void {
  const delta: Record<string, CanvasXY> = {
    ArrowLeft: { x: -16, y: 0 },
    ArrowRight: { x: 16, y: 0 },
    ArrowUp: { x: 0, y: -16 },
    ArrowDown: { x: 0, y: 16 },
  };
  const move = delta[event.key];
  if (!move) return;
  event.preventDefault();
  if (!selection.includes(shape.id)) model.selectAt(centerOf(shape));
  selection = [...model.selection];
  moveSelected(move);
}

function addNote(): void {
  const id = model.addPriorityNote();
  if (!id) {
    announcement = 'A priority note could not be added.';
    return;
  }
  sync('Priority note added and selected.');
}

function connectSelected(): void {
  const id = model.connectSelection();
  if (!id) {
    announcement = 'Select two shapes before connecting them.';
    return;
  }
  sync('Selected shapes connected.');
  additive = false;
}

function undo(): void {
  if (!model.undo()) {
    announcement = 'There is no canvas edit to undo.';
    return;
  }
  sync('Last canvas edit undone.');
  additive = false;
}

function reset(): void {
  model.reset();
  canvas = model.doc;
  selection = [];
  additive = false;
  sourceVisible = false;
  announcement = 'Launch plan canvas reset to its starting example.';
}
</script>

<section class="canvas-demo" aria-label="Interactive launch plan canvas">
  <div class="canvas-demo__toolbar" role="group" aria-label="Canvas actions">
    <button type="button" onclick={addNote}>Add priority note</button>
    <button type="button" onclick={() => moveSelected({ x: -16, y: 0 })}>Move left</button>
    <button type="button" onclick={() => moveSelected({ x: 16, y: 0 })}>Move right</button>
    <button type="button" onclick={() => moveSelected({ x: 0, y: -16 })}>Move up</button>
    <button type="button" onclick={() => moveSelected({ x: 0, y: 16 })}>Move down</button>
    <button type="button" onclick={connectSelected} disabled={selection.length !== 2}>
      Connect selected
    </button>
    <button type="button" onclick={undo} disabled={!model.canUndo}>Undo</button>
    <button type="button" onclick={reset}>Reset</button>
    <button
      type="button"
      aria-expanded={sourceVisible}
      aria-controls="canvas-demo-source"
      onclick={() => (sourceVisible = !sourceVisible)}
    >
      {sourceVisible ? 'Hide source' : 'View source'}
    </button>
  </div>

  <label class="canvas-demo__additive">
    <input type="checkbox" bind:checked={additive} />
    Add selected shapes to the connection selection
  </label>
  <p class="canvas-demo__selection">{selection.length} shapes selected</p>
  <p class="canvas-demo__announcement" role="status" aria-live="polite" aria-atomic="true">
    {announcement}
  </p>

  <div class="canvas-demo__layout">
    <div class="canvas-demo__viewer">
      <CanvasViewer {canvas} label="Launch plan canvas" />
    </div>

    <div class="canvas-demo__shapes">
      <h3>Canvas shapes</h3>
      <p id="canvas-shape-help" class="canvas-demo__hint">
        Select a shape. Use the arrow keys to move it, or hold the selection toggle to choose two shapes to connect.
      </p>
      <ul aria-describedby="canvas-shape-help">
        {#each shapes as entry (entry.shape.id)}
          {@const shape = entry.shape}
          <li data-depth={entry.depth}>
            <button
              type="button"
              class="canvas-demo__shape"
              aria-pressed={selection.includes(shape.id)}
              aria-label={`${shapeName(shape) || shape.type}, ${shape.type}`}
              onclick={() => selectShape(shape)}
              onkeydown={(event) => moveWithKey(event, shape)}
            >
              <span>{shapeName(shape) || shape.type}</span>
              <span class="canvas-demo__kind">{shape.type}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- The source can scroll horizontally and vertically, so keyboard users need a named focus target. -->
  <pre id="canvas-demo-source" class="canvas-demo__source" role="region" aria-label="Canvas source as JSON" tabindex="0" hidden={!sourceVisible}><code>{source}</code></pre>
</section>

<style>
  .canvas-demo {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
    color: var(--tx-foreground, CanvasText);
  }
  .canvas-demo__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .canvas-demo button,
  .canvas-demo input {
    min-block-size: 2.75rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: inherit;
    font: inherit;
  }
  .canvas-demo button {
    cursor: pointer;
    touch-action: manipulation;
  }
  .canvas-demo button:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
  .canvas-demo button:focus-visible,
  .canvas-demo input:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .canvas-demo__additive {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-block-size: 2.75rem;
  }
  .canvas-demo__additive input {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }
  .canvas-demo__selection,
  .canvas-demo__announcement,
  .canvas-demo__hint {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
  .canvas-demo__announcement {
    min-block-size: 1.25em;
  }
  .canvas-demo__layout {
    display: grid;
    gap: 1rem;
    min-inline-size: 0;
  }
  .canvas-demo__viewer {
    min-inline-size: 0;
    overflow: hidden;
  }
  .canvas-demo__shapes {
    display: grid;
    align-content: start;
    gap: 0.5rem;
  }
  .canvas-demo__shapes h3 {
    margin: 0;
    font-size: 1rem;
  }
  .canvas-demo__shapes ul {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .canvas-demo__shapes li[data-depth='1'] {
    margin-inline-start: 1rem;
  }
  .canvas-demo__shape {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    inline-size: 100%;
    text-align: start;
  }
  .canvas-demo__shape[aria-pressed='true'] {
    border-color: var(--tx-ring, Highlight);
    box-shadow: inset 0 0 0 1px var(--tx-ring, Highlight);
  }
  .canvas-demo__kind {
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.75rem;
  }
  .canvas-demo__source {
    max-block-size: 18rem;
    overflow: auto;
    margin: 0;
    padding: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-surface, Canvas);
    font: 0.8rem/1.5 var(--tx-font-mono, ui-monospace, monospace);
    white-space: pre;
  }
  @media (min-width: 58rem) {
    .canvas-demo__layout {
      grid-template-columns: minmax(0, 1.5fr) minmax(15rem, 0.8fr);
      align-items: start;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .canvas-demo,
    .canvas-demo * {
      scroll-behavior: auto;
      animation-duration: 0.01ms;
      animation-iteration-count: 1;
      transition-duration: 0.01ms;
    }
  }
  @media (forced-colors: active) {
    .canvas-demo button,
    .canvas-demo input,
    .canvas-demo__source {
      border-color: ButtonText;
    }
  }
</style>
