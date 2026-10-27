<script lang="ts">
import { WorkflowEditor } from '@texuli/workflows/editor';
import type { WorkflowGraph } from '@texuli/workflows/model';
import { NODE_SIZE, PIPELINE_REGISTRY, pipelineGraph } from './pipeline.ts';

/**
 * The full @texuli/workflows editor on the fictional order pipeline:
 * palette, canvas, toolbar (with auto-layout), inspector, outline and
 * minimap. Edits stay in this page; reset brings the sample back.
 */

// Raw state: the editor emits new immutable graphs; a deep proxy would only cost time.
let graph = $state.raw<WorkflowGraph>(pipelineGraph('LR'));
let rtl = $state(false);
let editorKey = $state(0);

const counts = $derived(`${graph.nodes.length} steps, ${graph.edges.length} connections`);

function reset(): void {
  graph = pipelineGraph('LR');
  editorKey += 1;
}
</script>

<div class="wf-editor">
  <div class="wf-editor__bar">
    <p class="wf-editor__counts" data-workflow-counts>{counts}</p>
    <label class="wf-editor__toggle"><input type="checkbox" bind:checked={rtl} /> Right to left</label>
    <button type="button" class="wf-editor__reset" onclick={reset}>Reset the sample</button>
  </div>
  {#key `${editorKey}:${rtl}`}
    <WorkflowEditor
      {graph}
      registry={PIPELINE_REGISTRY}
      nodeSize={() => NODE_SIZE}
      dir={rtl ? 'rtl' : 'ltr'}
      onchange={(next) => (graph = next)}
    />
  {/key}
</div>

<style>
  .wf-editor {
    display: grid;
    gap: 0.75rem;
    min-inline-size: 0;
  }
  .wf-editor__bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }
  .wf-editor__counts {
    margin: 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, CanvasText);
  }
  .wf-editor__toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-block-size: 2.25rem;
  }
  .wf-editor__reset {
    min-block-size: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-surface, ButtonFace);
    color: inherit;
    font: inherit;
  }
</style>
