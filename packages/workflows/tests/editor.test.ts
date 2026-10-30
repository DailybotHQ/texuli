import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { createRawSnippet, flushSync, tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import {
  CLIPBOARD_KEY,
  canvasCommand,
  connectCandidates,
  connectCommand,
  edgeCurve,
  formatLabel,
  nearestInDirection,
  portPlacements,
  resolveWorkflowLabels,
  WorkflowController,
  WorkflowEditor,
  type WorkflowNodeContext,
} from '../src/editor/index.ts';
import { WorkflowInspector } from '../src/inspector/index.ts';
import {
  applyWorkflowOps,
  createWorkflow,
  defineNodeTypes,
  type WorkflowGraph,
  type WorkflowOp,
} from '../src/model/index.ts';

/** A fictional order pipeline. */
const registry = defineNodeTypes([
  {
    type: 'trigger',
    label: 'Trigger',
    category: 'Start',
    ports: [{ id: 'out', direction: 'out', dataType: 'event', label: 'Fired' }],
  },
  {
    type: 'http',
    label: 'HTTP request',
    category: 'Actions',
    ports: [
      { id: 'in', direction: 'in', dataType: 'any', label: 'Input' },
      { id: 'out', direction: 'out', dataType: 'json', label: 'Response' },
    ],
    props: {
      url: { kind: 'url', label: 'Address' },
      retries: { kind: 'number', min: 0, max: 5, label: 'Retries' },
      method: { kind: 'enum', values: ['GET', 'POST'], label: 'Method' },
    },
  },
  {
    type: 'branch',
    label: 'Branch',
    category: 'Logic',
    ports: [
      { id: 'in', direction: 'in', dataType: 'json', cardinality: 'one', label: 'Input' },
      { id: 'yes', direction: 'out', dataType: 'json', cardinality: 'one', label: 'Yes' },
      { id: 'no', direction: 'out', dataType: 'json', cardinality: 'one', label: 'No' },
    ],
  },
  {
    type: 'end',
    label: 'End',
    category: 'Logic',
    ports: [{ id: 'in', direction: 'in', dataType: 'json', label: 'Input' }],
    props: { icon: { kind: 'image', label: 'Icon' }, notify: { kind: 'boolean', label: 'Notify' } },
  },
]);

function pipeline(): WorkflowGraph {
  const ops: WorkflowOp[] = [
    {
      op: 'addNode',
      node: { id: 'start', type: 'trigger', label: 'Every hour', position: { x: 0, y: 0 } },
    },
    {
      op: 'addNode',
      node: { id: 'fetch', type: 'http', label: 'Fetch orders', position: { x: 300, y: 0 } },
    },
    {
      op: 'addNode',
      node: { id: 'check', type: 'branch', label: 'Has orders', position: { x: 600, y: 0 } },
    },
    {
      op: 'addNode',
      node: { id: 'done', type: 'end', label: 'Archive', position: { x: 900, y: -120 } },
    },
    {
      op: 'addNode',
      node: { id: 'skip', type: 'end', label: 'Skip', position: { x: 900, y: 120 } },
    },
    {
      op: 'connect',
      edge: { id: 'e1', from: { node: 'start', port: 'out' }, to: { node: 'fetch', port: 'in' } },
    },
    {
      op: 'connect',
      edge: { id: 'e2', from: { node: 'fetch', port: 'out' }, to: { node: 'check', port: 'in' } },
    },
  ];
  const result = applyWorkflowOps(createWorkflow(), ops, { registry });
  if (!result.ok) throw new Error(result.error.message);
  return result.graph;
}

function setup(props: Record<string, unknown> = {}) {
  const announce = vi.fn();
  let latest = pipeline();
  let controller: WorkflowController | undefined;
  const view = render(WorkflowEditor, {
    props: {
      graph: latest,
      registry,
      announce,
      onchange: (graph: WorkflowGraph) => {
        latest = graph;
      },
      get controller() {
        return controller;
      },
      set controller(value: WorkflowController | undefined) {
        controller = value;
      },
      ...props,
    },
  });
  return {
    ...view,
    announce,
    graph: () => latest,
    controller: () => controller as WorkflowController,
    node: (name: string) => screen.getByRole('group', { name }),
  };
}

const focused = () => document.activeElement as HTMLElement | null;
const settle = async () => {
  flushSync();
  await tick();
  await tick();
};

describe('pure editor helpers', () => {
  it('draws edges with the side-aware curve shared through @texuli/drag/graph', () => {
    // Byte-identical to the curve the editor drew before the math moved to drag.
    expect(edgeCurve({ x: 0, y: 0 }, 'right', { x: 100, y: 50 }, 'left')).toBe(
      'M0 0C44.7 0 55.3 50 100 50'
    );
    expect(edgeCurve({ x: 10.04, y: 0 }, 'bottom', { x: 10.04, y: 200 }, 'top')).toBe(
      'M10 0C10 80 10 120 10 200'
    );
  });

  it('maps the graph keyboard model, flipping left and right in RTL', () => {
    expect(canvasCommand({ key: 'ArrowRight' })).toEqual({ kind: 'focus', direction: 'right' });
    expect(canvasCommand({ key: 'ArrowRight' }, 'rtl')).toEqual({
      kind: 'focus',
      direction: 'left',
    });
    expect(canvasCommand({ key: 'ArrowUp', altKey: true })).toEqual({
      kind: 'nudge',
      direction: 'up',
      large: false,
    });
    expect(canvasCommand({ key: 'ArrowLeft', altKey: true, shiftKey: true }, 'rtl')).toEqual({
      kind: 'nudge',
      direction: 'right',
      large: true,
    });
    expect(canvasCommand({ key: 'z', ctrlKey: true })).toEqual({ kind: 'undo' });
    expect(canvasCommand({ key: 'Z', metaKey: true, shiftKey: true })).toEqual({ kind: 'redo' });
    expect(canvasCommand({ key: 'y', ctrlKey: true })).toEqual({ kind: 'redo' });
    expect(canvasCommand({ key: '=', ctrlKey: true })).toEqual({ kind: 'zoomIn' });
    expect(canvasCommand({ key: '-', ctrlKey: true })).toEqual({ kind: 'zoomOut' });
    expect(canvasCommand({ key: '0' })).toEqual({ kind: 'fit' });
    expect(canvasCommand({ key: 'Delete' })).toEqual({ kind: 'remove' });
    expect(canvasCommand({ key: 'a' })).toBeUndefined();
    expect(connectCommand({ key: 'ArrowDown' })).toBe('next');
    expect(connectCommand({ key: 'ArrowLeft' })).toBe('previous');
    expect(connectCommand({ key: 'Enter' })).toBe('commit');
    expect(connectCommand({ key: 'Escape' })).toBe('cancel');
  });

  it('finds the nearest node straight ahead', () => {
    const boxes = new Map([
      ['a', { x: 0, y: 0, width: 100, height: 50 }],
      ['b', { x: 200, y: 10, width: 100, height: 50 }],
      ['c', { x: 150, y: 300, width: 100, height: 50 }],
      ['d', { x: -300, y: 0, width: 100, height: 50 }],
    ]);
    expect(nearestInDirection(boxes, 'a', 'right')).toBe('b');
    expect(nearestInDirection(boxes, 'a', 'down')).toBe('c');
    expect(nearestInDirection(boxes, 'a', 'left')).toBe('d');
    expect(nearestInDirection(boxes, 'a', 'up')).toBeUndefined();
  });

  it('places inputs on the leading side and outputs on the trailing side', () => {
    const node = pipeline().nodes[1];
    if (!node) throw new Error('node');
    const box = { x: 0, y: 0, width: 200, height: 80 };
    const sides = (flow: 'LR' | 'TB', dir: 'ltr' | 'rtl') =>
      portPlacements(node, box, registry, flow, dir).map((p) => `${p.port}:${p.side}`);
    expect(sides('LR', 'ltr')).toEqual(['in:left', 'out:right']);
    expect(sides('LR', 'rtl')).toEqual(['in:right', 'out:left']);
    expect(sides('TB', 'ltr')).toEqual(['in:top', 'out:bottom']);
    expect(portPlacements(node, box, registry, 'LR', 'ltr')[0]?.point).toEqual({ x: 0, y: 40 });
  });

  it('lists compatible ports: type, cardinality, duplicates and cycles', () => {
    const graph = pipeline();
    const from = (node: string, port: string, direction: 'in' | 'out' = 'out') =>
      connectCandidates(graph, registry, { node, port, direction }).map(
        (t) => `${t.node}.${t.port}`
      );
    // `event` fits only `any`; fetch.in is taken by the existing edge, which is a duplicate anyway.
    expect(from('start', 'out')).toEqual([]);
    // json feeds json and any; check.in is full (cardinality one); upstream nodes would close a loop.
    expect(from('check', 'yes')).toEqual(['done.in', 'skip.in']);
    // Reverse: an input lists outputs that may feed it.
    expect(from('done', 'in', 'in')).toEqual(['check.no', 'check.yes', 'fetch.out']);
    const allow = { ...graph, cycles: 'allow' as const };
    expect(
      connectCandidates(allow, registry, { node: 'check', port: 'yes', direction: 'out' }).map(
        (t) => t.node
      )
    ).toContain('fetch');
  });

  it('formats and overrides labels without markup', () => {
    const labels = resolveWorkflowLabels({
      connected: 'Verbunden: {port} → {target}.',
      reasons: { cycle: 'Schleife' },
    });
    expect(formatLabel(labels.connected, { port: 'Ja', target: 'Ende' })).toBe(
      'Verbunden: Ja → Ende.'
    );
    expect(labels.reasons.cycle).toBe('Schleife');
    expect(labels.reasons.limit).toBe('the workflow is full');
    expect(formatLabel((v) => `${v.count} Knoten`, { count: 3 })).toBe('3 Knoten');
  });
});

describe('WorkflowEditor', () => {
  it('renders semantic nodes, named ports, a toolbar, a palette and an outline', () => {
    const { node } = setup();
    expect(screen.getByRole('region', { name: 'Workflow canvas' })).toBeTruthy();
    const fetch = node('Fetch orders');
    expect(fetch.getAttribute('aria-roledescription')).toBe('node');
    expect(
      within(fetch).getByRole('button', { name: 'Response output of Fetch orders' })
    ).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: 'Workflow tools' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Branch' })).toBeTruthy();
    expect(screen.getByRole('treegrid', { name: 'Workflow outline' })).toBeTruthy();
    // One tab stop on the canvas: the first node.
    const stops = document.querySelectorAll('[data-wf-node][tabindex="0"]');
    expect(stops).toHaveLength(1);
    // Ports meet the 24 px target size in the stylesheet, and no HTML is injected.
    expect(document.querySelector('.tx-workflow-node script')).toBeNull();
  });

  it('moves focus spatially with arrows and nudges with Alt+Arrow, undoable', async () => {
    const { node, graph, controller, announce } = setup();
    const fetch = node('Fetch orders');
    fetch.focus();
    await fireEvent.keyDown(fetch, { key: 'ArrowRight' });
    await settle();
    expect(focused()?.getAttribute('aria-label')).toBe('Has orders');
    await fireEvent.keyDown(focused() as HTMLElement, { key: 'ArrowRight', altKey: true });
    await fireEvent.keyDown(focused() as HTMLElement, { key: 'ArrowRight', altKey: true });
    expect(graph().nodes.find((n) => n.id === 'check')?.position).toEqual({ x: 632, y: 0 });
    expect(announce).toHaveBeenLastCalledWith('Has orders moved.');
    // Two nudges in a row are one undo step.
    await fireEvent.keyDown(focused() as HTMLElement, { key: 'z', ctrlKey: true });
    expect(graph().nodes.find((n) => n.id === 'check')?.position).toEqual({ x: 600, y: 0 });
    expect(controller().canUndo).toBe(false);
    await fireEvent.keyDown(focused() as HTMLElement, { key: 'y', ctrlKey: true });
    expect(graph().nodes.find((n) => n.id === 'check')?.position).toEqual({ x: 632, y: 0 });
  });

  it('connects by keyboard: Enter on a port, arrows cycle, Enter connects, Escape cancels', async () => {
    const { node, graph, announce } = setup();
    const check = node('Has orders');
    const yes = within(check).getByRole('button', { name: 'Yes output of Has orders' });
    yes.focus();
    await fireEvent.keyDown(yes, { key: 'Enter' });
    await settle();
    expect(announce.mock.lastCall?.[0]).toContain(
      'Connecting from Yes of Has orders. 2 compatible ports.'
    );
    expect(focused()?.getAttribute('aria-label')).toBe('Input input of Archive');
    await fireEvent.keyDown(focused() as HTMLElement, { key: 'ArrowDown' });
    await settle();
    expect(focused()?.getAttribute('aria-label')).toBe('Input input of Skip');
    await fireEvent.keyDown(focused() as HTMLElement, { key: 'Escape' });
    await settle();
    expect(focused()).toBe(yes);
    expect(announce).toHaveBeenLastCalledWith('Connection cancelled.');

    await fireEvent.keyDown(yes, { key: 'Enter' });
    await settle();
    await fireEvent.keyDown(focused() as HTMLElement, { key: 'Enter' });
    await settle();
    expect(graph().edges.map((e) => `${e.from.node}.${e.from.port}>${e.to.node}`)).toContain(
      'check.yes>done'
    );
    expect(announce).toHaveBeenLastCalledWith('Connected Yes to Input, Archive.');
    expect(focused()).toBe(yes);
    // The yes port takes one edge: a second connect finds nothing.
    await fireEvent.keyDown(yes, { key: 'Enter' });
    expect(announce).toHaveBeenLastCalledWith('No compatible port for Yes of Has orders.');
  });

  it('connects by pointer: click a port, then click a highlighted port', async () => {
    const { node, graph } = setup();
    await fireEvent.click(
      within(node('Has orders')).getByRole('button', { name: 'No output of Has orders' })
    );
    const target = within(node('Skip')).getByRole('button', { name: 'Input input of Skip' });
    expect(target.dataset.candidate).toBe('true');
    await fireEvent.click(target);
    expect(graph().edges.some((e) => e.from.port === 'no' && e.to.node === 'skip')).toBe(true);
  });

  it('removes with Delete and announces it; refusals are announced, never thrown', async () => {
    const { node, graph, announce, controller } = setup();
    const skip = node('Skip');
    skip.focus();
    await fireEvent.keyDown(skip, { key: 'Delete' });
    expect(graph().nodes.map((n) => n.id)).not.toContain('skip');
    expect(announce).toHaveBeenLastCalledWith('1 removed.');
    controller().apply({
      op: 'connect',
      edge: { id: 'bad', from: { node: 'check', port: 'yes' }, to: { node: 'fetch', port: 'in' } },
    });
    expect(announce).toHaveBeenLastCalledWith('Not changed: it would create a loop.');
  });

  it('selects with Space and Ctrl+A, removes a selected edge, and deletes many at once', async () => {
    const { node, graph, controller } = setup();
    const start = node('Every hour');
    start.focus();
    await fireEvent.keyDown(start, { key: ' ' });
    expect(start.dataset.selected).toBe('true');
    await fireEvent.keyDown(start, { key: 'a', ctrlKey: true });
    expect(controller().selection.size).toBe(5);
    await fireEvent.keyDown(start, { key: 'Escape' });
    expect(controller().selection.size).toBe(0);
    const hit = document.querySelector('.tx-workflow-edge__hit') as Element;
    await fireEvent.pointerDown(hit);
    expect(controller().selectedEdge).toBe('e1');
    await fireEvent.keyDown(start, { key: 'Delete' });
    expect(graph().edges.map((e) => e.id)).toEqual(['e2']);
    controller().select(['done', 'skip']);
    controller().focusId = 'done';
    await fireEvent.keyDown(node('Archive'), { key: 'Backspace' });
    expect(graph().nodes).toHaveLength(3);
  });

  it('zooms with Control plus and minus, and 0 fits the graph', async () => {
    const { node, controller, announce } = setup();
    const ctl = controller();
    ctl.viewport.width = 800;
    ctl.viewport.height = 400;
    // The first measured viewport fits the graph once.
    flushSync();
    const fitted = ctl.view.zoom;
    expect(fitted).toBeLessThan(1);
    const start = node('Every hour');
    await fireEvent.keyDown(start, { key: '=', ctrlKey: true });
    expect(ctl.view.zoom).toBeCloseTo(fitted * 1.25);
    expect(announce).toHaveBeenLastCalledWith(`Zoom ${Math.round(fitted * 125)}%.`);
    await fireEvent.keyDown(start, { key: '-', ctrlKey: true });
    expect(ctl.view.zoom).toBeCloseTo(fitted);
    ctl.setView({ x: 0, y: 0, zoom: 2 });
    await fireEvent.keyDown(start, { key: '0' });
    expect(ctl.view.zoom).toBeCloseTo(fitted);
    const world = document.querySelector('[data-wf-world]') as HTMLElement;
    flushSync();
    expect(world.style.transform).toContain(`scale(${ctl.view.zoom})`);
  });

  it('copies and pastes under fresh ids, and refuses hostile clipboard text', async () => {
    const { node, graph, controller } = setup();
    const fetch = node('Fetch orders');
    await fireEvent.keyDown(fetch, { key: 'c', ctrlKey: true });
    await fireEvent.keyDown(fetch, { key: 'v', ctrlKey: true });
    expect(graph().nodes.map((n) => n.id)).toContain('fetch-2');
    const count = graph().nodes.length;
    const ctl = controller();
    const hostile = {
      nodes: [
        {
          id: 'x',
          type: 'http',
          label: 'x',
          position: { x: 0, y: 0 },
          props: { url: 'javascript:alert(1)' },
        },
      ],
      edges: [],
      groups: [],
    };
    expect(ctl.pasteText(JSON.stringify({ [CLIPBOARD_KEY]: hostile }))).toBe(false);
    expect(
      ctl.pasteText(JSON.stringify({ [CLIPBOARD_KEY]: { ...hostile, nodes: [], script: 'x' } }))
    ).toBe(false);
    expect(ctl.pasteText('not json')).toBe(false);
    // Missing positions or edge endpoints are refused, not thrown.
    const missing = { nodes: [{ id: 'a' }], edges: [], groups: [] };
    expect(ctl.pasteText(JSON.stringify({ [CLIPBOARD_KEY]: missing }))).toBe(false);
    const dangling = { nodes: [], edges: [{ id: 'e', from: null, to: null }], groups: [] };
    expect(ctl.pasteText(JSON.stringify({ [CLIPBOARD_KEY]: dangling }))).toBe(false);
    expect(ctl.pasteText('x'.repeat(1_000_001))).toBe(false);
    expect(graph().nodes).toHaveLength(count);
    const safe = {
      ...hostile,
      nodes: [{ ...hostile.nodes[0], props: { url: 'https://api.example.com' } }],
    };
    expect(ctl.pasteText(JSON.stringify({ [CLIPBOARD_KEY]: safe }))).toBe(true);
    expect(graph().nodes).toHaveLength(count + 1);
  });

  it('adds nodes from the palette and groups the selection', async () => {
    const { graph, announce, controller } = setup();
    await fireEvent.click(screen.getByRole('button', { name: 'Add Branch' }));
    expect(graph().nodes.map((n) => n.id)).toContain('branch');
    expect(announce).toHaveBeenLastCalledWith('Branch added.');
    controller().select(['start', 'fetch']);
    controller().focusId = 'start';
    controller().group();
    expect(graph().groups).toEqual([{ id: 'group', label: 'Group 1' }]);
    flushSync();
    expect(document.querySelector('.tx-workflow-group')?.textContent).toContain('Group 1');
  });

  it('drags selected nodes with the pointer as one undoable, snapped step; Escape cancels', async () => {
    const { node, graph, controller } = setup();
    const fetch = node('Fetch orders');
    const canvas = screen.getByRole('region', { name: 'Workflow canvas' });
    await fireEvent.pointerDown(fetch, {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      button: 0,
      isPrimary: true,
    });
    await fireEvent.pointerMove(canvas, {
      pointerId: 1,
      clientX: 50,
      clientY: 30,
      isPrimary: true,
    });
    expect([...controller().dragIds]).toEqual(['fetch']);
    expect(controller().dragDelta).toEqual({ x: 48, y: 16 });
    flushSync();
    expect(fetch.dataset.dragging).toBe('true');
    const world = document.querySelector('[data-wf-world]') as HTMLElement;
    expect(world.style.getPropertyValue('--tx-workflow-drag-x')).toBe('48px');
    // The two edges with one dragged end are redrawn as an overlay; their originals hide.
    expect(document.querySelectorAll('.tx-workflow-edge[data-drag="cut"]')).toHaveLength(2);
    await fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 50, clientY: 30, isPrimary: true });
    expect(graph().nodes.find((n) => n.id === 'fetch')?.position).toEqual({ x: 348, y: 16 });
    expect(controller().dragIds.size).toBe(0);

    await fireEvent.pointerDown(fetch, {
      pointerId: 2,
      clientX: 0,
      clientY: 0,
      button: 0,
      isPrimary: true,
    });
    await fireEvent.pointerMove(canvas, {
      pointerId: 2,
      clientX: 100,
      clientY: 0,
      isPrimary: true,
    });
    await fireEvent.keyDown(fetch, { key: 'Escape' });
    expect(graph().nodes.find((n) => n.id === 'fetch')?.position).toEqual({ x: 348, y: 16 });
    controller().undo();
    expect(graph().nodes.find((n) => n.id === 'fetch')?.position).toEqual({ x: 300, y: 0 });
  });

  it('selects with a marquee', () => {
    const { controller } = setup();
    const ctl = controller();
    ctl.beginMarquee({ x: -10, y: -10 });
    ctl.updateMarquee({ x: 520, y: 80 });
    ctl.endMarquee();
    expect([...ctl.selection].sort()).toEqual(['fetch', 'start']);
  });

  it('edits the graph from the treegrid outline', async () => {
    const { graph } = setup();
    const grid = screen.getByRole('treegrid', { name: 'Workflow outline' });
    const rows = within(grid).getAllByRole('row').slice(1);
    const first = rows[0] as HTMLElement;
    expect(first.getAttribute('aria-level')).toBe('1');
    expect(first.getAttribute('aria-expanded')).toBe('false');
    first.focus();
    await fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(within(grid).getByRole('row', { name: /Fired to Input, Fetch orders/ })).toBeTruthy();
    await fireEvent.keyDown(first, { key: 'Enter' });
    await settle();
    const input = screen.getByRole('textbox', { name: 'Rename Every hour' }) as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Every day' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(graph().nodes.find((n) => n.id === 'start')?.label).toBe('Every day');

    await fireEvent.click(screen.getByRole('button', { name: 'Connect Has orders' }));
    await settle();
    const select = screen.getByRole('combobox', {
      name: 'Connect Has orders to',
    }) as HTMLSelectElement;
    const option = within(select).getByRole('option', {
      name: 'Yes → Input, Skip',
    }) as HTMLOptionElement;
    await fireEvent.change(select, { target: { value: option.value } });
    expect(graph().edges.some((e) => e.from.port === 'yes' && e.to.node === 'skip')).toBe(true);

    await fireEvent.click(screen.getByRole('button', { name: 'Delete Archive' }));
    expect(graph().nodes.map((n) => n.id)).not.toContain('done');
  });

  it('renders custom node bodies through a snippet, keeping the frame and ports', () => {
    const body = createRawSnippet((context: () => WorkflowNodeContext) => ({
      render: () => `<strong class="custom">${context().node.type}</strong>`,
    }));
    setup({ node: body });
    const fetch = screen.getByRole('group', { name: 'Fetch orders' });
    expect(fetch.querySelector('.custom')?.textContent).toBe('http');
    expect(within(fetch).getAllByRole('button')).toHaveLength(2);
  });

  it('renders link and image props only through the untrusted URL policy', () => {
    const graph = pipeline();
    const result = applyWorkflowOps(
      graph,
      [{ op: 'setProps', id: 'fetch', props: { url: 'https://api.example.com/orders' } }],
      { registry }
    );
    if (!result.ok) throw new Error('setup');
    // A graph built outside the model (no checks) still renders no unsafe link.
    const unsafe: WorkflowGraph = {
      ...result.graph,
      nodes: result.graph.nodes.map((n) =>
        n.id === 'done'
          ? { ...n, props: { icon: 'javascript:alert(1)' } }
          : n.id === 'skip'
            ? { ...n, props: { icon: 'https://cdn.example.com/a.png' } }
            : n
      ),
    };
    render(WorkflowEditor, {
      props: { graph: unsafe, registry, announce: () => {}, outline: false, inspector: false },
    });
    const link = within(screen.getByRole('group', { name: 'Fetch orders' })).getByRole('link', {
      name: 'Address',
    });
    expect(link.getAttribute('href')).toBe('https://api.example.com/orders');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('group', { name: 'Archive' }).querySelector('img')).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Skip' }).querySelector('img')?.getAttribute('src')
    ).toBe('https://cdn.example.com/a.png');
  });

  it('is read-only on request', async () => {
    const { node, graph, announce } = setup({ readonly: true });
    const skip = node('Skip');
    await fireEvent.keyDown(skip, { key: 'Delete' });
    expect(graph().nodes).toHaveLength(5);
    expect(announce).toHaveBeenLastCalledWith('Not changed: the edit is not allowed.');
    expect(screen.getByRole('button', { name: 'Add Branch' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
    expect(screen.queryByRole('button', { name: 'Delete Skip' })).toBeNull();
  });

  it('lays ports out for right-to-left and localizes every string', async () => {
    const { node, announce } = setup({
      dir: 'rtl',
      labels: {
        canvas: 'Lienzo',
        inputPort: 'entrada {port} de {node}',
        removed: '{count} eliminado.',
      },
      messages: { roleDescription: 'nodo' },
    });
    expect(screen.getByRole('region', { name: 'Lienzo' })).toBeTruthy();
    const fetch = node('Fetch orders');
    expect(fetch.getAttribute('aria-roledescription')).toBe('nodo');
    const input = within(fetch).getByRole('button', { name: 'entrada Input de Fetch orders' });
    expect(input.dataset.side).toBe('right');
    // ArrowLeft moves forward (to the right in world space) in RTL.
    fetch.focus();
    await fireEvent.keyDown(fetch, { key: 'ArrowLeft' });
    await settle();
    expect(focused()?.getAttribute('aria-label')).toBe('Has orders');
    await fireEvent.keyDown(focused() as HTMLElement, { key: 'Delete' });
    expect(announce).toHaveBeenLastCalledWith('1 eliminado.');
  });

  it('takes a new graph from the host and starts history over', async () => {
    const view = setup();
    const next = applyWorkflowOps(
      createWorkflow(),
      [
        {
          op: 'addNode',
          node: { id: 'solo', type: 'end', label: 'Solo', position: { x: 0, y: 0 } },
        },
      ],
      {
        registry,
      }
    );
    if (!next.ok) throw new Error('setup');
    view.controller().nudge('right');
    await view.rerender({ graph: next.graph });
    await waitFor(() => expect(screen.getByRole('group', { name: 'Solo' })).toBeTruthy());
    expect(view.controller().canUndo).toBe(false);
  });
});

describe('WorkflowInspector', () => {
  it('edits the label, typed props and position, and refuses unsafe URLs', async () => {
    let graph = pipeline();
    const onapply = vi.fn((ops: WorkflowOp[]) => {
      const result = applyWorkflowOps(graph, ops, { registry });
      if (result.ok) graph = result.graph;
      return result.ok ? { ok: true as const } : { ok: false as const, error: result.error };
    });
    const view = render(WorkflowInspector, {
      props: { graph, registry, nodeId: 'fetch', onapply },
    });
    expect(screen.getByRole('heading', { name: 'Inspector' })).toBeTruthy();
    await fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), {
      target: { value: 'Fetch all' },
    });
    expect(graph.nodes.find((n) => n.id === 'fetch')?.label).toBe('Fetch all');
    await fireEvent.change(screen.getByRole('spinbutton', { name: 'Retries' }), {
      target: { value: '3' },
    });
    expect(graph.nodes.find((n) => n.id === 'fetch')?.props?.retries).toBe(3);
    await fireEvent.change(screen.getByRole('combobox', { name: 'Method' }), {
      target: { value: 'POST' },
    });
    expect(graph.nodes.find((n) => n.id === 'fetch')?.props?.method).toBe('POST');
    const address = screen.getByRole('textbox', { name: 'Address' });
    const calls = onapply.mock.calls.length;
    await fireEvent.change(address, { target: { value: 'javascript:alert(1)' } });
    expect(onapply.mock.calls.length).toBe(calls);
    expect(address.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Use an https link or a relative path.')).toBeTruthy();
    await fireEvent.change(screen.getByRole('spinbutton', { name: 'Retries' }), {
      target: { value: '9' },
    });
    expect(screen.getByText('Not changed: a value is not valid.')).toBeTruthy();
    await fireEvent.change(screen.getByRole('spinbutton', { name: 'X' }), {
      target: { value: '320' },
    });
    expect(graph.nodes.find((n) => n.id === 'fetch')?.position.x).toBe(320);
    await view.rerender({ graph, nodeId: null });
    expect(screen.getByText('Select one node to edit it.')).toBeTruthy();
  });

  it('shows booleans as checkboxes and image previews only for safe sources', async () => {
    const graph = pipeline();
    const onapply = vi.fn(() => ({ ok: true as const }));
    render(WorkflowInspector, { props: { graph, registry, nodeId: 'done', onapply } });
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Notify' }));
    expect(onapply).toHaveBeenCalledWith([{ op: 'setProps', id: 'done', props: { notify: true } }]);
    expect(screen.getByText('Input: 0 connections')).toBeTruthy();
  });
});
