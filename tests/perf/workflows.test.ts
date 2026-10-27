// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import {
  buildScene,
  WorkflowController,
  WorkflowEditor,
} from '../../packages/workflows/src/editor/index.ts';
import { layoutMoves, layoutWorkflow } from '../../packages/workflows/src/layout/index.ts';
import {
  applyWorkflowOp,
  applyWorkflowOps,
  createWorkflow,
  createWorkflowHistory,
  defineNodeTypes,
  parseWorkflow,
  stringifyWorkflow,
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowEdge,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowOp,
} from '../../packages/workflows/src/model/index.ts';

declare const process: { env: Record<string, string | undefined> };

/*
 * Wall-clock limits for @texuli/workflows at the hard caps: 500 nodes and
 * 2,000 edges. Each budget is the larger of a fixed floor and a multiple of a
 * native 100k sort measured on the same machine, so slow CI hosts scale the
 * budget instead of flaking. Interactive paths (one drag frame, one connect)
 * are held to a share of a 16 ms frame; whole-graph paths (parse, layout)
 * to what a user tolerates once, when a workflow opens or is re-laid out.
 * The editor rows mount the whole Svelte editor in happy-dom, which makes
 * DOM work 5-20x slower than a browser and noisy on a busy machine: the
 * same 50-node drag frame measures a p75 of about 4 ms in Chromium and 3 ms
 * in WebKit (the TEXULI_PERF row of tests/behavior/scenarios/
 * workflow-editor.spec.ts, which holds the 16 ms frame limit). These rows
 * are regression guards with about 3x headroom over the worst of repeated
 * local runs; the rendering they guard against is far slower (a full
 * re-render per frame measured about 580 ms here before the scene cache and
 * the CSS-transform drag).
 * Run via `pnpm test:perf`; `TEXULI_PERF_REPORT=1` prints the measurements.
 */

function createRng(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function bestOfThree(work: () => unknown): number {
  work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

const random = createRng('workflows');
const baselineMs = bestOfThree(() => Float64Array.from({ length: 100_000 }, random).sort());
const budget = (floorMs: number, factor: number) => Math.max(floorMs, factor * baselineMs);
const report = (name: string, ms: number) => {
  if (process.env.TEXULI_PERF_REPORT === '1')
    console.log(`[perf] ${name}: ${ms.toFixed(2)} ms (baseline ${baselineMs.toFixed(1)} ms)`);
};

const registry = defineNodeTypes([
  {
    type: 'step',
    label: 'Step',
    ports: [
      { id: 'in', direction: 'in', dataType: 'json' },
      { id: 'out', direction: 'out', dataType: 'json' },
    ],
    props: { url: { kind: 'url' }, note: { kind: 'text' } },
  },
]);
const context = { registry };

/** A layered acyclic pipeline at the caps: 500 nodes, 2,000 forward edges, no duplicates. */
function largeDocument() {
  const nodes: WorkflowNode[] = Array.from({ length: 500 }, (_, i) => ({
    id: `n${i}`,
    type: 'step',
    label: `Step ${i}`,
    position: { x: 0, y: 0 },
    props: { url: `https://api.example.com/steps/${i}`, note: 'Fictional step' },
  }));
  const edges: WorkflowEdge[] = [];
  const seen = new Set<string>();
  while (edges.length < 2000) {
    const a = Math.floor(random() * 499);
    const b = a + 1 + Math.floor(random() * Math.min(40, 499 - a));
    if (seen.has(`${a}>${b}`)) continue;
    seen.add(`${a}>${b}`);
    edges.push({
      id: `e${edges.length}`,
      from: { node: `n${a}`, port: 'out' },
      to: { node: `n${b}`, port: 'in' },
    });
  }
  return { version: WORKFLOW_SCHEMA_VERSION, cycles: 'forbid', nodes, edges };
}

const doc = largeDocument();
const parsed = parseWorkflow(doc, context);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics.slice(0, 3)));
const graph: WorkflowGraph = parsed.graph;

describe('workflows at the caps (500 nodes, 2,000 edges)', () => {
  it('parses and validates the document', () => {
    expect(process.env.TEXULI_PERF).toBe('1');
    expect(graph.nodes).toHaveLength(500);
    expect(graph.edges).toHaveLength(2000);
    const ms = bestOfThree(() => parseWorkflow(doc, context));
    report('parse 500/2000', ms);
    expect(ms).toBeLessThan(budget(60, 6));
  });

  it('builds the graph from one batch of 2,500 ops with per-edge cycle checks', () => {
    const ops: WorkflowOp[] = [
      ...doc.nodes.map((node): WorkflowOp => ({ op: 'addNode', node })),
      ...doc.edges.map((edge): WorkflowOp => ({ op: 'connect', edge })),
    ];
    let edges = 0;
    const ms = bestOfThree(() => {
      const result = applyWorkflowOps(createWorkflow(), ops, context);
      edges = result.ok ? result.graph.edges.length : 0;
    });
    expect(edges).toBe(2000);
    report('batch build 2500 ops', ms);
    expect(ms).toBeLessThan(budget(60, 6));
  });

  it('lays out the graph', () => {
    let crossings = 0;
    const ms = bestOfThree(() => {
      crossings = layoutWorkflow(graph).crossings;
    });
    report(`layout (crossings ${crossings})`, ms);
    expect(ms).toBeLessThan(budget(150, 15));
    const lr = layoutWorkflow(graph);
    expect(lr.positions.size).toBe(500);
    // Applying the layout is one undoable moveNodes op.
    const moved = bestOfThree(() =>
      applyWorkflowOp(graph, { op: 'moveNodes', moves: layoutMoves(lr) }, context)
    );
    report('apply layout moves', moved);
    expect(moved).toBeLessThan(budget(8, 1));
  });

  it('keeps every drag frame of a 50-node selection within a share of a 16 ms frame', () => {
    const selection = graph.nodes.slice(0, 50).map((node) => node.id);
    let worst = 0;
    let total = 0;
    const frames = 120;
    const history = createWorkflowHistory(graph, context);
    for (let frame = 1; frame <= frames; frame++) {
      const moves = selection.map((id, i) => ({ id, x: frame * 2, y: i * 80 + frame }));
      const started = performance.now();
      const result = history.apply({ op: 'moveNodes', moves }, { coalesceKey: 'drag' });
      const ms = performance.now() - started;
      expect(result.ok).toBe(true);
      worst = Math.max(worst, ms);
      total += ms;
    }
    report('drag frame (mean)', total / frames);
    report('drag frame (worst)', worst);
    expect(total / frames).toBeLessThan(budget(2, 0.2));
    expect(worst).toBeLessThan(budget(16, 1.5));
    // The whole gesture is one undo step back to the start.
    expect(history.undo()).toBe(true);
    expect(history.graph).toBe(graph);
    expect(history.canUndo).toBe(false);
  });

  it('connects one edge with a full cycle check, and serializes canonically', () => {
    const edge: WorkflowEdge = {
      id: 'probe',
      from: { node: 'n0', port: 'out' },
      to: { node: 'n499', port: 'in' },
    };
    // The reverse edge walks the whole reachable graph before refusing.
    const back: WorkflowEdge = {
      id: 'back',
      from: { node: 'n499', port: 'out' },
      to: { node: 'n0', port: 'in' },
    };
    const connectMs = bestOfThree(() => applyWorkflowOp(graph, { op: 'connect', edge }, context));
    const cycleMs = bestOfThree(() => {
      const result = applyWorkflowOp(graph, { op: 'connect', edge: back }, context);
      expect(result.ok).toBe(false);
    });
    report('connect', connectMs);
    report('connect refused as cycle', cycleMs);
    expect(Math.max(connectMs, cycleMs)).toBeLessThan(budget(8, 1));
    let length = 0;
    const stringifyMs = bestOfThree(() => {
      length = stringifyWorkflow(graph).length;
    });
    report(`stringify (${length} chars)`, stringifyMs);
    expect(stringifyMs).toBeLessThan(budget(30, 3));
  });
});

// Mounting 500 nodes in happy-dom takes about a second alone and several under
// parallel load: the limits below are relative to the baseline, the timeout is
// only a ceiling so a loaded machine never reports a hang as a regression.
describe('workflow editor at the caps (500 nodes, 2,000 edges)', { timeout: 60_000 }, () => {
  const laidOut = (() => {
    const result = applyWorkflowOp(
      graph,
      { op: 'moveNodes', moves: layoutMoves(layoutWorkflow(graph)) },
      context
    );
    if (!result.ok) throw new Error(result.error.message);
    return result.graph;
  })();

  it('builds the scene (boxes, ports, 2,000 edge paths) within a share of a frame', () => {
    let edges = 0;
    const ms = bestOfThree(() => {
      edges = buildScene(laidOut, registry).edges.length;
    });
    expect(edges).toBe(2000);
    report('scene 500/2000', ms);
    expect(ms).toBeLessThan(budget(8, 0.6));
  });

  it('mounts the full editor (canvas, minimap, outline, palette, inspector)', () => {
    let nodes = 0;
    const ms = bestOfThree(() => {
      const view = render(WorkflowEditor, {
        props: { graph: laidOut, registry, announce: () => {} },
      });
      flushSync();
      nodes = view.container.querySelectorAll('[data-wf-node]').length;
      view.unmount();
    });
    expect(nodes).toBe(500);
    report('editor mount 500/2000', ms);
    expect(ms).toBeLessThan(budget(3000, 150));
  });

  it('moves a 50-node pointer drag with one transform per frame, then drops as one step', () => {
    let controller: WorkflowController | undefined;
    const view = render(WorkflowEditor, {
      props: {
        graph: laidOut,
        registry,
        announce: () => {},
        outline: false,
        get controller() {
          return controller;
        },
        set controller(value: WorkflowController | undefined) {
          controller = value;
        },
      },
    });
    flushSync();
    const ctl = controller as WorkflowController;
    ctl.select(laidOut.nodes.slice(0, 50).map((node) => node.id));
    ctl.beginDrag(laidOut.nodes[0]?.id as string);
    const frames: number[] = [];
    for (let frame = 1; frame <= 60; frame++) {
      const started = performance.now();
      ctl.updateDrag({ x: frame * 16, y: frame * 8 });
      flushSync();
      frames.push(performance.now() - started);
    }
    const started = performance.now();
    ctl.endDrag();
    flushSync();
    const dropMs = performance.now() - started;
    const mean = frames.reduce((sum, ms) => sum + ms, 0) / frames.length;
    const worst = Math.max(...frames.slice(1));
    report('drag frame 50 of 500 (mean)', mean);
    report('drag frame 50 of 500 (worst after the first)', worst);
    report('drop 50 of 500', dropMs);
    expect(mean).toBeLessThan(budget(200, 10));
    expect(worst).toBeLessThan(budget(600, 30));
    expect(dropMs).toBeLessThan(budget(250, 12));
    expect(ctl.graph.nodes[0]?.position.x).toBe((laidOut.nodes[0]?.position.x ?? 0) + 960);
    expect(ctl.canUndo).toBe(true);
    view.unmount();
  });

  it('applies a keyboard nudge and its undo', () => {
    let controller: WorkflowController | undefined;
    const view = render(WorkflowEditor, {
      props: {
        graph: laidOut,
        registry,
        announce: () => {},
        outline: false,
        get controller() {
          return controller;
        },
        set controller(value: WorkflowController | undefined) {
          controller = value;
        },
      },
    });
    flushSync();
    const ctl = controller as WorkflowController;
    ctl.focusId = laidOut.nodes[10]?.id ?? null;
    const ms = bestOfThree(() => {
      ctl.nudge('right');
      flushSync();
      ctl.undo();
      flushSync();
    });
    report('nudge + undo', ms);
    expect(ms).toBeLessThan(budget(200, 10));
    view.unmount();
  });
});
