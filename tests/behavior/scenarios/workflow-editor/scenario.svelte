<script lang="ts">
import { flushSync } from 'svelte';
// The fixture app does not list @texuli/workflows yet (a lockfile-owner change),
// so the scenario imports the package's public entry points by path.
import {
  type WorkflowController,
  WorkflowEditor,
} from '../../../../packages/workflows/src/editor/index.ts';
import {
  applyWorkflowOps,
  createWorkflow,
  defineNodeTypes,
  type WorkflowGraph,
  type WorkflowOp,
} from '../../../../packages/workflows/src/model/index.ts';
import { behaviorEvent } from '../../harness/client/events.ts';

/** A fictional expense approval flow. */
const registry = defineNodeTypes([
  {
    type: 'request',
    label: 'Request',
    category: 'Start',
    ports: [{ id: 'out', direction: 'out', dataType: 'any', label: 'Submitted' }],
    props: { form: { kind: 'url', label: 'Form' } },
  },
  {
    type: 'review',
    label: 'Review',
    category: 'Steps',
    ports: [
      { id: 'in', direction: 'in', dataType: 'any', label: 'Input' },
      { id: 'approve', direction: 'out', dataType: 'any', cardinality: 'one', label: 'Approved' },
      { id: 'reject', direction: 'out', dataType: 'any', cardinality: 'one', label: 'Rejected' },
    ],
    props: { reviewer: { kind: 'text', label: 'Reviewer', maxLength: 80 } },
  },
  {
    type: 'done',
    label: 'Done',
    category: 'Steps',
    ports: [{ id: 'in', direction: 'in', dataType: 'any', label: 'Input' }],
  },
]);

function build(ops: WorkflowOp[]): WorkflowGraph {
  const result = applyWorkflowOps(createWorkflow(), ops, { registry, limits: {} });
  if (!result.ok) throw new Error(result.error.message);
  return result.graph;
}

function small(): WorkflowGraph {
  return build([
    {
      op: 'addNode',
      node: {
        id: 'ask',
        type: 'request',
        label: 'Expense request',
        position: { x: 0, y: 80 },
        props: { form: 'https://forms.example.com/expense' },
      },
    },
    {
      op: 'addNode',
      node: { id: 'lead', type: 'review', label: 'Team lead review', position: { x: 288, y: 80 } },
    },
    {
      op: 'addNode',
      node: { id: 'paid', type: 'done', label: 'Paid', position: { x: 576, y: 0 } },
    },
    {
      op: 'addNode',
      node: { id: 'closed', type: 'done', label: 'Closed', position: { x: 576, y: 160 } },
    },
    {
      op: 'connect',
      edge: { id: 'e1', from: { node: 'ask', port: 'out' }, to: { node: 'lead', port: 'in' } },
    },
    {
      op: 'connect',
      edge: { id: 'e2', from: { node: 'lead', port: 'approve' }, to: { node: 'paid', port: 'in' } },
    },
  ]);
}

/** 500 review steps and 2,000 forward edges, for the TEXULI_PERF drag measurement. */
function large(): WorkflowGraph {
  const ops: WorkflowOp[] = [];
  for (let i = 0; i < 500; i++) {
    ops.push({
      op: 'addNode',
      node: {
        id: `n${i}`,
        type: 'done',
        label: `Step ${i}`,
        position: { x: (i % 25) * 240, y: Math.floor(i / 25) * 120 },
      },
    });
  }
  const many = defineNodeTypes([
    {
      type: 'done',
      label: 'Step',
      ports: [
        { id: 'in', direction: 'in', dataType: 'any' },
        { id: 'out', direction: 'out', dataType: 'any' },
      ],
    },
  ]);
  let seed = 7;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const seen = new Set<string>();
  while (seen.size < 2000) {
    const a = Math.floor(random() * 499);
    const b = a + 1 + Math.floor(random() * Math.min(40, 499 - a));
    if (seen.has(`${a}>${b}`)) continue;
    seen.add(`${a}>${b}`);
    ops.push({
      op: 'connect',
      edge: {
        id: `e${seen.size}`,
        from: { node: `n${a}`, port: 'out' },
        to: { node: `n${b}`, port: 'in' },
      },
    });
  }
  const result = applyWorkflowOps(createWorkflow(), ops, { registry: many });
  if (!result.ok) throw new Error(result.error.message);
  largeRegistry = many;
  return result.graph;
}

let largeRegistry = registry;
const isLarge =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('size') === 'large';
let graph = $state.raw(isLarge ? large() : small());
let controller = $state<WorkflowController>();

/** Real-browser drag frames: update + synchronous render per frame, in ms. */
function bench(): number[] {
  const ctl = controller as WorkflowController;
  ctl.select(graph.nodes.slice(0, 50).map((node) => node.id));
  ctl.beginDrag(graph.nodes[0]?.id as string);
  const frames: number[] = [];
  for (let frame = 1; frame <= 30; frame++) {
    const started = performance.now();
    ctl.updateDrag({ x: frame * 16, y: frame * 8 });
    flushSync();
    frames.push(performance.now() - started);
  }
  ctl.endDrag();
  flushSync();
  return frames;
}

$effect(() => {
  (window as unknown as { __workflowBench?: () => number[] }).__workflowBench = bench;
});
</script>

<WorkflowEditor
  {graph}
  registry={isLarge ? largeRegistry : registry}
  bind:controller
  outline={!isLarge}
  onchange={(next, event) => {
    graph = next;
    behaviorEvent('change', event.type);
  }}
/>
