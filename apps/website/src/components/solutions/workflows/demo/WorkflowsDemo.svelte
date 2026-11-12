<script lang="ts">
import type { WorkflowGraph } from '@texuli/workflows/model';
import { WorkflowViewer } from '@texuli/workflows/viewer';
import { EXPENSE_APPROVAL_REGISTRY } from './fixtures/expense-approval.ts';
import { createWorkflowDemoModel, type WorkflowDemoResult } from './model.ts';

const model = createWorkflowDemoModel();
let graph = $state.raw<WorkflowGraph>(model.graph);
let selectedNodeId = $state<string | null>(null);
let labelDraft = $state('');
let sourceVisible = $state(false);
let announcement = $state(
  'Expense approval workflow loaded. Use the step list or action buttons to explore it.'
);

const selectedNode = $derived(
  selectedNodeId === null ? undefined : graph.nodes.find((node) => node.id === selectedNodeId)
);
const source = $derived(JSON.stringify(graph, null, 2));

function finish(result: WorkflowDemoResult, message: string): void {
  if (!result.ok) {
    announcement = result.error.message;
    return;
  }
  graph = result.graph;
  announcement = `${message} ${graph.nodes.length} steps and ${graph.edges.length} connections.`;
}

function selectNode(id: string, announce = true): void {
  if (!model.selectNode(id)) return;
  selectedNodeId = id;
  labelDraft = graph.nodes.find((node) => node.id === id)?.label ?? '';
  if (announce) announcement = `${labelDraft} selected.`;
}

function handleNodeKeydown(event: KeyboardEvent, id: string): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const current = graph.nodes.findIndex((node) => node.id === id);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? graph.nodes.length - 1
        : Math.max(
            0,
            Math.min(graph.nodes.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))
          );
  const node = graph.nodes[next];
  if (!node) return;
  selectNode(node.id);
  document.getElementById(`workflow-step-${node.id}`)?.focus();
}

function addStep(): void {
  const result = model.addStepFromPalette();
  finish(result, 'Notification step added.');
  if (result.ok) {
    const id = result.graph.nodes.at(-1)?.id;
    if (id) selectNode(id, false);
  }
}

function applyLabel(): void {
  if (!selectedNodeId) {
    announcement = 'Choose a workflow step before changing its label.';
    return;
  }
  if (!model.selectNode(selectedNodeId)) return;
  finish(model.changeSelectedNodeLabel(labelDraft), 'Step label updated.');
}

function autoLayout(): void {
  finish(model.autoLayout('LR'), 'Workflow arranged from left to right.');
}

function undo(): void {
  if (!model.undo()) {
    announcement = 'There is no action to undo.';
    return;
  }
  graph = model.graph;
  if (selectedNodeId && !graph.nodes.some((node) => node.id === selectedNodeId)) {
    selectedNodeId = null;
    labelDraft = '';
  }
  announcement = 'Last workflow change undone.';
}

function redo(): void {
  if (!model.redo()) {
    announcement = 'There is no action to redo.';
    return;
  }
  graph = model.graph;
  announcement = 'Workflow change restored.';
}

function reset(): void {
  model.reset();
  graph = model.graph;
  selectedNodeId = null;
  labelDraft = '';
  sourceVisible = false;
  announcement = 'Expense approval workflow reset to its starting example.';
}
</script>

<section
  class="workflow-demo"
  data-tx-workflows-demo=""
  data-demo-live=""
  aria-label="Interactive expense approval workflow"
>
  <div class="workflow-demo__toolbar" role="group" aria-label="Workflow actions">
    <button type="button" onclick={addStep}>Add notification</button>
    <button type="button" onclick={autoLayout}>Auto layout</button>
    <button type="button" onclick={undo} disabled={!model.canUndo}>Undo</button>
    <button type="button" onclick={redo} disabled={!model.canRedo}>Redo</button>
    <button type="button" onclick={reset}>Reset</button>
    <button
      type="button"
      aria-expanded={sourceVisible}
      aria-controls="workflow-demo-source"
      onclick={() => (sourceVisible = !sourceVisible)}
    >
      {sourceVisible ? 'Hide source' : 'View source'}
    </button>
  </div>

  <p class="workflow-demo__counts">{graph.nodes.length} steps · {graph.edges.length} connections</p>
  <p class="workflow-demo__announcement" role="status" aria-live="polite" aria-atomic="true">
    {announcement}
  </p>

  <div class="workflow-demo__layout">
    <div class="workflow-demo__graph">
      <WorkflowViewer
        {graph}
        registry={EXPENSE_APPROVAL_REGISTRY}
        label="Expense approval workflow graph"
      />
    </div>

    <div class="workflow-demo__steps">
      <h3>Workflow steps</h3>
      <p id="workflow-step-help" class="workflow-demo__hint">
        Select a step. Use the up and down arrow keys to move through the list.
      </p>
      <ul aria-describedby="workflow-step-help">
        {#each graph.nodes as node, index (node.id)}
          <li>
            <button
              id={`workflow-step-${node.id}`}
              type="button"
              class="workflow-demo__step"
              aria-pressed={selectedNodeId === node.id}
              onclick={() => selectNode(node.id)}
              onkeydown={(event) => handleNodeKeydown(event, node.id)}
            >
              <span class="workflow-demo__step-number">{index + 1}</span>
              <span>{node.label}</span>
            </button>
          </li>
        {/each}
      </ul>

      {#if selectedNode}
        <form
          class="workflow-demo__editor"
          aria-label="Edit selected workflow step"
          onsubmit={(event) => { event.preventDefault(); applyLabel(); }}
        >
          <label for="workflow-step-label">Step label</label>
          <input id="workflow-step-label" bind:value={labelDraft} maxlength="80" />
          <button type="submit">Update label</button>
        </form>
      {/if}
    </div>
  </div>

  <div
    id="workflow-demo-source"
    class="workflow-demo__source"
    role="region"
    aria-label="Workflow source as JSON"
    hidden={!sourceVisible}
  >
    <pre tabindex="0"><code>{source}</code></pre>
  </div>
</section>

<style>
  .workflow-demo {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
    color: var(--tx-foreground, CanvasText);
  }
  .workflow-demo__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .workflow-demo button,
  .workflow-demo input {
    min-block-size: 2.75rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-background, ButtonFace);
    color: inherit;
    font: inherit;
  }
  .workflow-demo button {
    cursor: pointer;
    touch-action: manipulation;
  }
  .workflow-demo button:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }
  .workflow-demo button:focus-visible,
  .workflow-demo input:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .workflow-demo__counts,
  .workflow-demo__announcement,
  .workflow-demo__hint {
    margin: 0;
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.875rem;
  }
  .workflow-demo__announcement {
    min-block-size: 1.25em;
  }
  .workflow-demo__layout {
    display: grid;
    gap: 1rem;
    min-inline-size: 0;
  }
  .workflow-demo__graph {
    min-inline-size: 0;
    overflow: hidden;
  }
  .workflow-demo__steps {
    display: grid;
    align-content: start;
    gap: 0.5rem;
  }
  .workflow-demo__steps h3 {
    margin: 0;
    font-size: 1rem;
  }
  .workflow-demo__steps ul {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .workflow-demo__step {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    inline-size: 100%;
    text-align: start;
  }
  .workflow-demo__step[aria-pressed='true'] {
    border-color: var(--tx-ring, Highlight);
    box-shadow: inset 0 0 0 1px var(--tx-ring, Highlight);
  }
  .workflow-demo__step-number {
    display: grid;
    flex: 0 0 1.75rem;
    place-items: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border-radius: 50%;
    background: var(--tx-muted, ButtonFace);
    font-size: 0.8rem;
    font-weight: 650;
  }
  .workflow-demo__editor {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .workflow-demo__editor label {
    flex-basis: 100%;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .workflow-demo__editor input {
    flex: 1 1 10rem;
    min-inline-size: 0;
  }
  .workflow-demo__source {
    margin: 0;
  }
  .workflow-demo__source pre {
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
    .workflow-demo__layout {
      grid-template-columns: minmax(0, 1.5fr) minmax(15rem, 0.8fr);
      align-items: start;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .workflow-demo,
    .workflow-demo * {
      scroll-behavior: auto;
      animation-duration: 0.01ms;
      animation-iteration-count: 1;
      transition-duration: 0.01ms;
    }
  }
  @media (forced-colors: active) {
    .workflow-demo button,
    .workflow-demo input,
    .workflow-demo__source pre {
      border-color: ButtonText;
    }
  }
</style>
