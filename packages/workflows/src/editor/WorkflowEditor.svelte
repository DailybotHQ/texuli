<script lang="ts">
import type { DragMessagesOverrides } from '@texuli/drag/messages';
import { type Snippet, untrack } from 'svelte';
import WorkflowInspector from '../inspector/WorkflowInspector.svelte';
import type { WorkflowEvent, WorkflowValidation } from '../model/history.ts';
import type { NodeTypeRegistry } from '../model/registry.ts';
import { stringifyWorkflow } from '../model/schema.ts';
import type { WorkflowGraph, WorkflowLimits, WorkflowNode } from '../model/types.ts';
import { WorkflowController } from './controller.svelte.ts';
import type { FlowDirection, NodeSize, TextDirection } from './geometry.ts';
import type { WorkflowLabelsOverrides } from './labels.ts';
import type { WorkflowNodeContext } from './types.ts';
import WorkflowCanvas from './WorkflowCanvas.svelte';
import WorkflowMinimap from './WorkflowMinimap.svelte';
import WorkflowOutline from './WorkflowOutline.svelte';
import WorkflowPalette from './WorkflowPalette.svelte';
import WorkflowToolbar from './WorkflowToolbar.svelte';

/**
 * The complete workflow editor: toolbar, palette, canvas with minimap,
 * inspector and treegrid outline over one controller. Each part is also
 * exported on its own, so a host can lay them out differently.
 */
interface Props {
  /**
   * The graph shown. Controlled: every change is reported to `onchange`;
   * pass the new graph back (keep it in `$state.raw`, which avoids a deep
   * proxy) or leave it unchanged. A different graph starts history over.
   */
  graph: WorkflowGraph;
  registry: NodeTypeRegistry;
  flow?: FlowDirection;
  dir?: TextDirection;
  nodeSize?: (node: WorkflowNode) => NodeSize;
  grid?: number;
  readonly?: boolean;
  limits?: Partial<WorkflowLimits>;
  validate?: (graph: WorkflowGraph) => WorkflowValidation;
  labels?: WorkflowLabelsOverrides;
  messages?: DragMessagesOverrides;
  announce?: (message: string) => void;
  /** Custom node body, rendered inside the editor's node frame. */
  node?: Snippet<[WorkflowNodeContext]>;
  /** Show the palette; a list limits it to those types. Default true. */
  palette?: boolean | readonly string[];
  toolbar?: boolean;
  minimap?: boolean;
  inspector?: boolean;
  outline?: boolean;
  onchange?: (graph: WorkflowGraph, event: WorkflowEvent) => void;
  /** The shared controller, for hosts that drive the editor (`bind:controller`). */
  controller?: WorkflowController;
  class?: string;
}

let {
  graph,
  registry,
  flow = 'LR',
  dir = 'ltr',
  nodeSize,
  grid = 16,
  readonly = false,
  limits,
  validate,
  labels,
  messages,
  announce,
  node,
  palette = true,
  toolbar = true,
  minimap = true,
  inspector = true,
  outline = true,
  onchange,
  controller = $bindable(),
  class: className = '',
}: Props = $props();

const editor = untrack(
  () =>
    new WorkflowController({
      graph,
      registry,
      flow,
      dir,
      grid,
      readonly,
      ...(nodeSize ? { nodeSize } : {}),
      ...(limits ? { limits } : {}),
      ...(validate ? { validate } : {}),
      ...(labels ? { labels } : {}),
      ...(messages ? { messages } : {}),
      ...(announce ? { announce } : {}),
      onchange: (next, event) => {
        onchange?.(next, event);
      },
    })
);
controller = editor;

$effect.pre(() => {
  const next = graph;
  const types = registry;
  untrack(() => {
    if (types !== editor.registry) editor.reset(next, types);
    else if (next !== editor.graph && !sameGraph(next, editor.graph)) editor.reset(next, types);
  });
});

$effect.pre(() => {
  editor.configure({
    flow,
    dir,
    grid,
    readonly,
    nodeSize,
    labels: labels ?? {},
    messages: messages ?? {},
  });
});

/**
 * A host that keeps the graph in a deep `$state` passes back a proxy of the
 * graph the editor emitted; equal canonical JSON (O(nodes + edges), only when
 * identities differ) keeps history instead of starting it over.
 */
function sameGraph(a: WorkflowGraph, b: WorkflowGraph): boolean {
  return (
    a.nodes.length === b.nodes.length &&
    a.edges.length === b.edges.length &&
    stringifyWorkflow(a) === stringifyWorkflow(b)
  );
}

const inspected = $derived.by(() => {
  if (editor.selection.size === 1) return [...editor.selection][0] ?? null;
  return editor.selection.size === 0 ? editor.focusId : null;
});
</script>

<div class={['tx-workflow-editor', className]} dir={dir}>
  {#if toolbar}
    <div class="tx-workflow-editor__toolbar"><WorkflowToolbar controller={editor} /></div>
  {/if}
  <div class="tx-workflow-editor__main" data-palette={palette !== false || undefined} data-inspector={inspector || undefined}>
    {#if palette !== false}
      <div class="tx-workflow-editor__palette">
        <WorkflowPalette controller={editor} types={Array.isArray(palette) ? palette : undefined} />
      </div>
    {/if}
    <WorkflowCanvas controller={editor} {node} class="tx-workflow-editor__canvas">
      {#if minimap}<WorkflowMinimap controller={editor} />{/if}
    </WorkflowCanvas>
    {#if inspector}
      <div class="tx-workflow-editor__inspector">
        <WorkflowInspector
          graph={editor.graph}
          registry={editor.registry}
          nodeId={inspected}
          readonly={editor.readonly}
          labels={labels ?? {}}
          onapply={(ops) => editor.apply(ops)}
        />
      </div>
    {/if}
  </div>
  {#if outline}
    <div class="tx-workflow-editor__outline"><WorkflowOutline controller={editor} /></div>
  {/if}
</div>

<style>
  @layer tx.components {
    .tx-workflow-editor {
      display: grid;
      gap: var(--tx-space-3);
      container-type: inline-size;
      color: var(--tx-foreground, CanvasText);
    }

    .tx-workflow-editor__main {
      display: grid;
      gap: var(--tx-space-3);
      grid-template-columns: minmax(0, 1fr);
    }

    .tx-workflow-editor__main > :global(.tx-workflow-editor__canvas) {
      min-block-size: 28rem;
    }

    @container (min-width: 56rem) {
      .tx-workflow-editor__main[data-palette][data-inspector] {
        grid-template-columns: 11rem minmax(0, 1fr) 16rem;
      }

      .tx-workflow-editor__main[data-palette]:not([data-inspector]) {
        grid-template-columns: 11rem minmax(0, 1fr);
      }

      .tx-workflow-editor__main[data-inspector]:not([data-palette]) {
        grid-template-columns: minmax(0, 1fr) 16rem;
      }
    }

    .tx-workflow-editor__outline {
      max-block-size: 20rem;
      overflow: auto;
    }
  }
</style>
