<script lang="ts">
import { WorkflowEditor } from '@texuli/workflows/editor';
import { type WorkflowGraph } from '@texuli/workflows/model';
import { fromSpecWorkflow, toSpecWorkflow } from '@texuli/workflows/spec-adapter';
import { WorkflowViewer } from '@texuli/workflows/viewer';
import { getPlayerInteraction } from '../context.ts';

/**
 * `workflow-graph`: a spec WorkflowGraph, checked in full by the workflow
 * model (closed node types, ports, cycles, limits, text safety) before it
 * paints. `view` paints the read-only viewer; `edit` the editor, whose
 * changes go back to a bound workflow variable and run `on.change`.
 */
let {
  label,
  graph,
  mode = 'view',
  flow = 'LR',
  txPath,
}: {
  label: string;
  graph: unknown;
  mode?: 'view' | 'edit';
  flow?: 'LR' | 'TB';
  txPath?: string;
} = $props();

const interaction = getPlayerInteraction();
const parsed = $derived(fromSpecWorkflow(graph));
let current = $state.raw<WorkflowGraph | null>(null);
$effect.pre(() => {
  current = parsed.ok ? parsed.graph : null;
});

function onchange(next: WorkflowGraph): void {
  current = next;
  if (!parsed.ok || txPath === undefined) return;
  const spec = toSpecWorkflow(next, parsed.registry);
  if (spec.ok && interaction?.bound(txPath, 'graph'))
    interaction.write(txPath, 'graph', spec.graph);
  interaction?.dispatch(txPath, 'change');
}
</script>

{#if !parsed.ok || current === null}
  <p class="tx-player-workflow-refused" role="note">{label}: this workflow could not be shown.</p>
{:else if mode === 'edit'}
  <WorkflowEditor graph={current} registry={parsed.registry} {flow} labels={{ canvas: label }} {onchange} />
{:else}
  <WorkflowViewer graph={current} registry={parsed.registry} {flow} {label} />
{/if}
