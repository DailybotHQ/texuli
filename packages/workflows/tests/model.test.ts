// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  applyWorkflowOp,
  applyWorkflowOps,
  copyFragment,
  createNode,
  createWorkflow,
  createWorkflowHistory,
  defineNodeTypes,
  findCycleEdge,
  parseWorkflow,
  parseWorkflowOp,
  parseWorkflowOps,
  prepareFragment,
  stringifyWorkflow,
  toWorkflowJson,
  WORKFLOW_JSON_SCHEMA,
  WORKFLOW_LIMITS,
  WORKFLOW_SCHEMA_VERSION,
  type WorkflowContext,
  type WorkflowEdge,
  type WorkflowEvent,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowOp,
} from '../src/model/index.ts';

/** A fictional order pipeline: a trigger, HTTP calls, a branch, transforms, an end. */
const registry = defineNodeTypes(
  [
    {
      type: 'trigger',
      label: 'Trigger',
      category: 'trigger',
      ports: [{ id: 'out', direction: 'out', dataType: 'event' }],
      props: { schedule: { kind: 'enum', values: ['hourly', 'daily'], default: 'daily' } },
    },
    {
      type: 'http',
      label: 'HTTP request',
      ports: [
        { id: 'in', direction: 'in', dataType: 'any' },
        { id: 'out', direction: 'out', dataType: 'json' },
      ],
      props: {
        url: { kind: 'url' },
        retries: { kind: 'number', min: 0, max: 5, default: 1 },
        note: { kind: 'text', maxLength: 40 },
      },
    },
    {
      type: 'branch',
      label: 'Branch',
      ports: [
        { id: 'in', direction: 'in', dataType: 'json', cardinality: 'one' },
        { id: 'yes', direction: 'out', dataType: 'json', cardinality: 'one' },
        { id: 'no', direction: 'out', dataType: 'json', cardinality: 'one' },
      ],
    },
    {
      type: 'transform',
      label: 'Transform',
      ports: [
        { id: 'in', direction: 'in', dataType: 'json' },
        { id: 'out', direction: 'out', dataType: 'json' },
        { id: 'count', direction: 'out', dataType: 'int' },
      ],
      props: { icon: { kind: 'image' }, enabled: { kind: 'boolean', default: true } },
    },
    {
      type: 'sum',
      label: 'Sum',
      ports: [
        { id: 'in', direction: 'in', dataType: 'number' },
        { id: 'out', direction: 'out', dataType: 'number' },
      ],
    },
    {
      type: 'end',
      label: 'End',
      ports: [{ id: 'in', direction: 'in', dataType: 'json' }],
    },
  ],
  { compatibility: { int: ['number'] } }
);
const context: WorkflowContext = { registry };

function node(id: string, type = 'transform', x = 0, y = 0): WorkflowNode {
  return { id, type, label: id, position: { x, y } };
}

function edge(id: string, from: string, to: string, fromPort = 'out', toPort = 'in'): WorkflowEdge {
  return { id, from: { node: from, port: fromPort }, to: { node: to, port: toPort } };
}

function apply(graph: WorkflowGraph, ops: WorkflowOp[], ctx = context): WorkflowGraph {
  const result = applyWorkflowOps(graph, ops, ctx);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.graph;
}

function errorOf(graph: WorkflowGraph, ops: WorkflowOp[], ctx = context) {
  const result = applyWorkflowOps(graph, ops, ctx);
  if (result.ok) throw new Error('expected a refusal');
  return result.error;
}

/** trigger → http → branch → (yes) end, (no) transform. */
function pipeline(): WorkflowGraph {
  return apply(createWorkflow(), [
    { op: 'addNode', node: node('start', 'trigger') },
    { op: 'addNode', node: node('fetch', 'http', 200) },
    { op: 'addNode', node: node('check', 'branch', 400) },
    { op: 'addNode', node: node('done', 'end', 600) },
    { op: 'addNode', node: node('shape', 'transform', 600, 100) },
    { op: 'connect', edge: edge('e1', 'start', 'fetch') },
    { op: 'connect', edge: edge('e2', 'fetch', 'check') },
    { op: 'connect', edge: edge('e3', 'check', 'done', 'yes') },
    { op: 'connect', edge: edge('e4', 'check', 'shape', 'no') },
  ]);
}

describe('defineNodeTypes', () => {
  it('freezes the registry and answers type, port and compatibility questions', () => {
    expect(registry.types).toEqual(['trigger', 'http', 'branch', 'transform', 'sum', 'end']);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(registry.port('branch', 'yes')?.cardinality).toBe('one');
    expect(registry.compatible('json', 'json')).toBe(true);
    expect(registry.compatible('json', 'any')).toBe(true);
    expect(registry.compatible('int', 'number')).toBe(true);
    expect(registry.compatible('number', 'int')).toBe(false);
  });

  it('throws on malformed specs', () => {
    const port = { id: 'in', direction: 'in', dataType: 'json' } as const;
    expect(() =>
      defineNodeTypes([
        { type: 'a', label: 'A', ports: [] },
        { type: 'a', label: 'A', ports: [] },
      ])
    ).toThrow(/twice/);
    expect(() => defineNodeTypes([{ type: 'a', label: 'A', ports: [port, port] }])).toThrow(
      /twice/
    );
    expect(() => defineNodeTypes([{ type: 'bad type', label: 'A', ports: [] }])).toThrow(
      /valid id/
    );
    expect(() =>
      defineNodeTypes([
        { type: 'a', label: 'A', ports: [], props: JSON.parse('{"constructor":{"kind":"text"}}') },
      ])
    ).toThrow(/not an identifier/);
    expect(() =>
      defineNodeTypes([
        { type: 'a', label: 'A', ports: [], props: { pick: { kind: 'enum', values: [] } } },
      ])
    ).toThrow(/needs values/);
  });
});

describe('nodes', () => {
  it('adds a node and never mutates the input graph', () => {
    const empty = createWorkflow();
    const result = applyWorkflowOp(empty, { op: 'addNode', node: node('a') }, context);
    expect(result.ok && result.graph.nodes.map((n) => n.id)).toEqual(['a']);
    expect(empty.nodes).toEqual([]);
    expect(result.ok && result.inverse).toEqual([{ op: 'removeNode', id: 'a' }]);
  });

  it('refuses unknown types, duplicate ids and undeclared props', () => {
    const graph = pipeline();
    expect(errorOf(graph, [{ op: 'addNode', node: node('x', 'script') }]).code).toBe(
      'unknown-type'
    );
    expect(errorOf(graph, [{ op: 'addNode', node: node('e1') }]).code).toBe('duplicate-id');
    const extra = { ...node('x', 'http'), props: { code: 'alert(1)' } };
    expect(errorOf(graph, [{ op: 'addNode', node: extra }])).toMatchObject({
      code: 'invalid-value',
      path: '/node/props/code',
    });
    expect(errorOf(graph, [{ op: 'addNode', node: { ...node('x'), id: '../x' } }]).code).toBe(
      'invalid-value'
    );
  });

  it('passes URL props through the untrusted URL policy', () => {
    const graph = pipeline();
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<b>x</b>',
      '//evil.example',
      'jav​ascript:x',
    ]) {
      const hostile = { ...node('x', 'http'), props: { url } };
      expect(errorOf(graph, [{ op: 'addNode', node: hostile }]).code).toBe('unsafe-url');
    }
    const icon = { ...node('y', 'transform'), props: { icon: 'javascript:alert(1)' } };
    expect(errorOf(graph, [{ op: 'addNode', node: icon }]).code).toBe('unsafe-url');
    const safe = apply(graph, [
      {
        op: 'addNode',
        node: { ...node('x', 'http'), props: { url: 'https://api.example.com/orders' } },
      },
    ]);
    expect(safe.nodes.find((n) => n.id === 'x')?.props?.url).toBe('https://api.example.com/orders');
  });

  it('refuses control and bidi override characters in labels and text props', () => {
    const graph = pipeline();
    for (const label of ['pay‮yas', 'a\u0000b', 'x⁦y']) {
      expect(errorOf(graph, [{ op: 'addNode', node: { ...node('x'), label } }]).code).toBe(
        'unsafe-text'
      );
    }
    const note = { ...node('x', 'http'), props: { note: 'x'.repeat(41) } };
    expect(errorOf(graph, [{ op: 'addNode', node: note }]).code).toBe('limit');
    expect(
      apply(graph, [{ op: 'addNode', node: { ...node('x'), label: 'طلب جديد\nnext' } }]).nodes
    ).toHaveLength(6);
  });

  it('checks prop kinds and ranges', () => {
    const graph = pipeline();
    const bad = (props: Record<string, unknown>, type = 'http') =>
      errorOf(graph, [{ op: 'addNode', node: { ...node('x', type), props } as WorkflowNode }]).code;
    expect(bad({ retries: 9 })).toBe('invalid-value');
    expect(bad({ retries: Number.NaN })).toBe('invalid-value');
    expect(bad({ retries: '1' })).toBe('invalid-value');
    expect(bad({ schedule: 'weekly' }, 'trigger')).toBe('invalid-value');
    expect(bad({ enabled: 'yes' }, 'transform')).toBe('invalid-value');
  });

  it('refuses positions out of range and enforces the node limit', () => {
    const graph = pipeline();
    const far = { ...node('x'), position: { x: 2e6, y: 0 } };
    expect(errorOf(graph, [{ op: 'addNode', node: far }]).code).toBe('invalid-value');
    const small = { registry, limits: { maxNodes: 5 } };
    expect(errorOf(graph, [{ op: 'addNode', node: node('x') }], small).code).toBe('limit');
  });

  it('never lets a host raise a limit above the hard cap', () => {
    const many = Array.from(
      { length: 501 },
      (_, i): WorkflowOp => ({ op: 'addNode', node: node(`n${i}`) })
    );
    const error = errorOf(createWorkflow(), many, { registry, limits: { maxNodes: 10_000 } });
    expect(error).toMatchObject({ code: 'limit', opIndex: 500 });
  });

  it('builds nodes with declared defaults', () => {
    expect(createNode(registry, 'http', { id: 'n', position: { x: 1, y: 2 } })).toEqual({
      id: 'n',
      type: 'http',
      label: 'HTTP request',
      position: { x: 1, y: 2 },
      props: { retries: 1 },
    });
    expect(() => createNode(registry, 'nope', { id: 'n', position: { x: 0, y: 0 } })).toThrow(
      TypeError
    );
  });

  it('removes a node with its edges and restores both on inverse', () => {
    const graph = pipeline();
    const result = applyWorkflowOp(graph, { op: 'removeNode', id: 'check' }, context);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.graph.edges.map((e) => e.id)).toEqual(['e1']);
    expect(result.inverse.map((op) => op.op)).toEqual(['addNode', 'connect', 'connect', 'connect']);
    expect(stringifyWorkflow(apply(result.graph, [...result.inverse]))).toBe(
      stringifyWorkflow(graph)
    );
  });
});

describe('moveNodes', () => {
  it('moves nodes and returns the old positions as the inverse', () => {
    const result = applyWorkflowOp(
      pipeline(),
      { op: 'moveNodes', moves: [{ id: 'fetch', x: 210, y: 5 }] },
      context
    );
    expect(result.ok && result.graph.nodes.find((n) => n.id === 'fetch')?.position).toEqual({
      x: 210,
      y: 5,
    });
    expect(result.ok && result.inverse).toEqual([
      { op: 'moveNodes', moves: [{ id: 'fetch', x: 200, y: 0 }] },
    ]);
  });

  it('is a no-op for unchanged positions and shares the edge list', () => {
    const graph = pipeline();
    const same = applyWorkflowOp(
      graph,
      { op: 'moveNodes', moves: [{ id: 'fetch', x: 200, y: 0 }] },
      context
    );
    expect(same.ok && same.changed).toBe(false);
    expect(same.ok && same.graph).toBe(graph);
    const moved = apply(graph, [{ op: 'moveNodes', moves: [{ id: 'fetch', x: 1, y: 1 }] }]);
    expect(moved.edges).toBe(graph.edges);
    expect(moved.groups).toBe(graph.groups);
  });

  it('refuses unknown, repeated and non-finite moves', () => {
    const graph = pipeline();
    expect(errorOf(graph, [{ op: 'moveNodes', moves: [{ id: 'nope', x: 0, y: 0 }] }]).code).toBe(
      'unknown-id'
    );
    expect(
      errorOf(graph, [
        {
          op: 'moveNodes',
          moves: [
            { id: 'fetch', x: 0, y: 0 },
            { id: 'fetch', x: 1, y: 0 },
          ],
        },
      ]).code
    ).toBe('invalid-value');
    expect(
      errorOf(graph, [
        { op: 'moveNodes', moves: [{ id: 'fetch', x: Number.POSITIVE_INFINITY, y: 0 }] },
      ]).code
    ).toBe('invalid-value');
  });
});

describe('connect', () => {
  it('checks port existence, direction, data type and compatibility', () => {
    const graph = apply(pipeline(), [
      { op: 'addNode', node: node('t2') },
      { op: 'addNode', node: node('total', 'sum') },
      { op: 'addNode', node: node('h2', 'http') },
    ]);
    expect(errorOf(graph, [{ op: 'connect', edge: edge('x', 'shape', 't2', 'nope') }]).code).toBe(
      'unknown-port'
    );
    expect(
      errorOf(graph, [{ op: 'connect', edge: edge('x', 'shape', 't2', 'in', 'in') }]).code
    ).toBe('port-direction');
    expect(
      errorOf(graph, [{ op: 'connect', edge: edge('x', 'shape', 't2', 'out', 'out') }]).code
    ).toBe('port-direction');
    expect(errorOf(graph, [{ op: 'connect', edge: edge('x', 'shape', 'total') }]).code).toBe(
      'port-type'
    );
    // `int` feeds `number` through the registry compatibility table.
    expect(
      apply(graph, [{ op: 'connect', edge: edge('x', 'shape', 'total', 'count') }]).edges
    ).toHaveLength(5);
    // `any` accepts every type.
    expect(apply(graph, [{ op: 'connect', edge: edge('x', 'start', 'h2') }]).edges).toHaveLength(5);
    expect(errorOf(graph, [{ op: 'connect', edge: edge('x', 'start', 't2') }]).code).toBe(
      'port-type'
    );
    expect(errorOf(graph, [{ op: 'connect', edge: edge('x', 'ghost', 't2') }]).code).toBe(
      'unknown-id'
    );
  });

  it('enforces cardinality and refuses duplicate edges', () => {
    const graph = apply(pipeline(), [{ op: 'addNode', node: node('other', 'http') }]);
    expect(errorOf(graph, [{ op: 'connect', edge: edge('x', 'other', 'check') }])).toMatchObject({
      code: 'cardinality',
      path: '/edge/to/port',
    });
    expect(errorOf(graph, [{ op: 'connect', edge: edge('x', 'check', 'shape', 'yes') }]).code).toBe(
      'cardinality'
    );
    expect(errorOf(graph, [{ op: 'connect', edge: edge('x', 'start', 'fetch') }]).code).toBe(
      'duplicate-edge'
    );
  });

  it('names the op that closes a cycle inside a batch', () => {
    const graph = apply(pipeline(), [{ op: 'addNode', node: node('t') }]);
    const ops: WorkflowOp[] = [
      { op: 'connect', edge: edge('a', 'shape', 't') },
      { op: 'addNode', node: node('u') },
      { op: 'connect', edge: edge('b', 't', 'u') },
      { op: 'connect', edge: edge('c', 'u', 'fetch') },
      { op: 'connect', edge: edge('d', 'fetch', 'u', 'out', 'in') },
    ];
    expect(errorOf(graph, ops)).toMatchObject({ code: 'cycle', opIndex: 3 });
    expect(graph.edges).toHaveLength(4);
    // Without the closing edge the deferred whole-graph pass accepts the batch.
    expect(apply(graph, ops.slice(0, 3)).edges).toHaveLength(6);
  });

  it('forbids cycles and self-loops under the forbid policy, and allows them otherwise', () => {
    const graph = apply(pipeline(), [{ op: 'addNode', node: node('loop') }]);
    const back = edge('back', 'shape', 'fetch');
    expect(errorOf(graph, [{ op: 'connect', edge: back }]).code).toBe('cycle');
    expect(errorOf(graph, [{ op: 'connect', edge: edge('self', 'loop', 'loop') }]).code).toBe(
      'cycle'
    );
    const open = { ...graph, cycles: 'allow' as const };
    expect(apply(open, [{ op: 'connect', edge: back }]).edges).toHaveLength(5);
    expect(apply(open, [{ op: 'connect', edge: edge('self', 'loop', 'loop') }]).edges).toHaveLength(
      5
    );
  });

  it('enforces the edge limit', () => {
    const graph = pipeline();
    expect(
      errorOf(graph, [{ op: 'connect', edge: edge('x', 'shape', 'done') }], {
        registry,
        limits: { maxEdges: 4 },
      })
    ).toMatchObject({ code: 'limit' });
  });

  it('disconnects and reconnects, keeping the edge id and label', () => {
    const graph = apply(pipeline(), [
      { op: 'addNode', node: node('alt', 'end') },
      { op: 'setProps', id: 'e3', label: 'Approved' },
    ]);
    const moved = applyWorkflowOp(
      graph,
      { op: 'reconnect', id: 'e3', to: { node: 'alt', port: 'in' } },
      context
    );
    if (!moved.ok) throw new Error(moved.error.message);
    expect(moved.graph.edges.find((e) => e.id === 'e3')).toEqual({
      ...edge('e3', 'check', 'alt', 'yes'),
      label: 'Approved',
    });
    expect(stringifyWorkflow(apply(moved.graph, [...moved.inverse]))).toBe(
      stringifyWorkflow(graph)
    );
    expect(
      errorOf(graph, [{ op: 'reconnect', id: 'e3', from: { node: 'check', port: 'no' } }]).code
    ).toBe('cardinality');
    expect(errorOf(graph, [{ op: 'reconnect', id: 'e3' }]).code).toBe('invalid-value');
    expect(
      errorOf(graph, [{ op: 'reconnect', id: 'e1', to: { node: 'start', port: 'out' } }]).code
    ).toBe('port-direction');
    expect(
      errorOf(graph, [{ op: 'reconnect', id: 'e1', to: { node: 'fetch', port: 'nope' } }]).code
    ).toBe('unknown-port');
    const gone = apply(graph, [{ op: 'disconnect', id: 'e2' }]);
    expect(gone.edges.map((e) => e.id)).toEqual(['e1', 'e3', 'e4']);
    expect(errorOf(gone, [{ op: 'disconnect', id: 'e2' }]).code).toBe('unknown-id');
  });

  it('refuses a reconnect that would close a cycle', () => {
    const graph = apply(pipeline(), [
      { op: 'addNode', node: node('t') },
      { op: 'connect', edge: edge('x', 'shape', 't') },
    ]);
    expect(
      errorOf(graph, [{ op: 'reconnect', id: 'x', to: { node: 'fetch', port: 'in' } }]).code
    ).toBe('cycle');
  });
});

describe('setProps', () => {
  it('sets labels on nodes, edges and groups', () => {
    let graph = apply(pipeline(), [
      { op: 'group', group: { id: 'g', label: 'Intake' }, nodes: ['start'] },
    ]);
    graph = apply(graph, [
      { op: 'setProps', id: 'fetch', label: 'Fetch orders' },
      { op: 'setProps', id: 'e1', label: 'on schedule' },
      { op: 'setProps', id: 'g', label: 'Inbound' },
    ]);
    expect(graph.nodes.find((n) => n.id === 'fetch')?.label).toBe('Fetch orders');
    expect(graph.edges.find((e) => e.id === 'e1')?.label).toBe('on schedule');
    expect(graph.groups[0]?.label).toBe('Inbound');
    const cleared = apply(graph, [{ op: 'setProps', id: 'e1', label: '' }]);
    expect(cleared.edges.find((e) => e.id === 'e1')).not.toHaveProperty('label');
  });

  it('sets and unsets props with an exact inverse', () => {
    const graph = apply(pipeline(), [{ op: 'setProps', id: 'fetch', props: { retries: 2 } }]);
    const result = applyWorkflowOp(
      graph,
      {
        op: 'setProps',
        id: 'fetch',
        props: { url: 'https://api.example.com/v2' },
        unset: ['retries'],
      },
      context
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.graph.nodes.find((n) => n.id === 'fetch')?.props).toEqual({
      url: 'https://api.example.com/v2',
    });
    expect(result.inverse).toEqual([
      { op: 'setProps', id: 'fetch', props: { retries: 2 }, unset: ['url'] },
    ]);
    expect(stringifyWorkflow(apply(result.graph, [...result.inverse]))).toBe(
      stringifyWorkflow(graph)
    );
  });

  it('refuses props on edges, unknown ids, and a prop both set and unset', () => {
    const graph = pipeline();
    expect(errorOf(graph, [{ op: 'setProps', id: 'e1', props: { retries: 1 } }]).code).toBe(
      'invalid-op'
    );
    expect(errorOf(graph, [{ op: 'setProps', id: 'nope', label: 'x' }]).code).toBe('unknown-id');
    expect(
      errorOf(graph, [{ op: 'setProps', id: 'fetch', props: { retries: 1 }, unset: ['retries'] }])
        .code
    ).toBe('invalid-value');
    expect(
      errorOf(graph, [{ op: 'setProps', id: 'fetch', props: { url: 'javascript:void 0' } }]).code
    ).toBe('unsafe-url');
  });

  it('keeps hostile prop names as plain data without touching prototypes', () => {
    const props = JSON.parse('{"__proto__": {"polluted": true}}') as Record<string, never>;
    expect(errorOf(pipeline(), [{ op: 'setProps', id: 'fetch', props }]).code).toBe(
      'invalid-value'
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('groups', () => {
  it('groups and ungroups with exact inverses', () => {
    const graph = pipeline();
    const grouped = applyWorkflowOp(
      graph,
      { op: 'group', group: { id: 'g', label: 'Checks' }, nodes: ['fetch', 'check'] },
      context
    );
    if (!grouped.ok) throw new Error(grouped.error.message);
    expect(grouped.graph.nodes.filter((n) => n.group === 'g').map((n) => n.id)).toEqual([
      'fetch',
      'check',
    ]);
    const ungrouped = applyWorkflowOp(grouped.graph, { op: 'ungroup', id: 'g' }, context);
    if (!ungrouped.ok) throw new Error(ungrouped.error.message);
    expect(ungrouped.inverse).toEqual([
      { op: 'group', group: { id: 'g', label: 'Checks' }, nodes: ['check', 'fetch'] },
    ]);
    expect(stringifyWorkflow(ungrouped.graph)).toBe(stringifyWorkflow(graph));
  });

  it('refuses grouping a grouped node, unknown members and id clashes', () => {
    const graph = apply(pipeline(), [
      { op: 'group', group: { id: 'g', label: 'A' }, nodes: ['fetch'] },
    ]);
    expect(
      errorOf(graph, [{ op: 'group', group: { id: 'h', label: 'B' }, nodes: ['fetch'] }]).code
    ).toBe('already-grouped');
    expect(
      errorOf(graph, [{ op: 'group', group: { id: 'h', label: 'B' }, nodes: ['ghost'] }]).code
    ).toBe('unknown-id');
    expect(errorOf(graph, [{ op: 'group', group: { id: 'e1', label: 'B' }, nodes: [] }]).code).toBe(
      'duplicate-id'
    );
    expect(errorOf(graph, [{ op: 'addNode', node: { ...node('x'), group: 'nope' } }]).code).toBe(
      'unknown-id'
    );
  });
});

describe('copy and paste', () => {
  it('copies a selection with its inner edges and pastes it under fresh ids', () => {
    const graph = apply(pipeline(), [
      { op: 'group', group: { id: 'g', label: 'Checks' }, nodes: ['check'] },
    ]);
    const fragment = copyFragment(graph, ['fetch', 'check', 'missing']);
    expect(fragment.nodes.map((n) => n.id)).toEqual(['check', 'fetch']);
    expect(fragment.edges.map((e) => e.id)).toEqual(['e2']);
    expect(fragment.groups.map((g) => g.id)).toEqual(['g']);
    const ready = prepareFragment(graph, fragment, { offset: { x: 40, y: 40 } });
    expect(ready.nodes.map((n) => [n.id, n.position, n.group])).toEqual([
      ['check-2', { x: 440, y: 40 }, 'g-2'],
      ['fetch-2', { x: 240, y: 40 }, undefined],
    ]);
    expect(ready.edges).toEqual([edge('e2-2', 'fetch-2', 'check-2')]);
    const pasted = applyWorkflowOp(graph, { op: 'paste', fragment: ready }, context);
    if (!pasted.ok) throw new Error(pasted.error.message);
    expect(pasted.graph.nodes).toHaveLength(7);
    expect(stringifyWorkflow(apply(pasted.graph, [...pasted.inverse]))).toBe(
      stringifyWorkflow(graph)
    );
    // Pasting the same prepared fragment again clashes; preparing again does not.
    expect(errorOf(pasted.graph, [{ op: 'paste', fragment: ready }]).code).toBe('duplicate-id');
    const again = prepareFragment(pasted.graph, fragment);
    expect(again.nodes.map((n) => n.id)).toEqual(['check-3', 'fetch-3']);
  });

  it('refuses fragment edges that leave the fragment', () => {
    const fragment = { nodes: [node('n1')], edges: [edge('x', 'n1', 'done')], groups: [] };
    expect(errorOf(pipeline(), [{ op: 'paste', fragment }])).toMatchObject({
      code: 'invalid-value',
      path: '/fragment/edges/0',
    });
  });

  it('keeps generated ids within the id limit', () => {
    const long = 'n'.repeat(64);
    const graph = apply(createWorkflow(), [{ op: 'addNode', node: node(long) }]);
    const ready = prepareFragment(graph, copyFragment(graph, [long]));
    expect(ready.nodes[0]?.id).toHaveLength(64);
    expect(apply(graph, [{ op: 'paste', fragment: ready }]).nodes).toHaveLength(2);
  });
});

describe('batches', () => {
  it('applies all or none and reports the failing op index', () => {
    const graph = pipeline();
    const error = errorOf(graph, [
      { op: 'addNode', node: node('ok') },
      { op: 'connect', edge: edge('bad', 'ok', 'ghost') },
    ]);
    expect(error).toMatchObject({ code: 'unknown-id', opIndex: 1, path: '/edge/to/node' });
    expect(graph.nodes).toHaveLength(5);
  });

  it('refuses non-objects and unknown ops', () => {
    expect(errorOf(pipeline(), [null as unknown as WorkflowOp]).code).toBe('invalid-op');
    expect(errorOf(pipeline(), [{ op: 'eval' } as unknown as WorkflowOp]).code).toBe('invalid-op');
    expect(
      errorOf(
        pipeline(),
        Array.from({ length: 5001 }, () => ({ op: 'removeNode', id: 'x' }) as WorkflowOp)
      ).code
    ).toBe('limit');
  });
});

describe('parseWorkflowOp', () => {
  it('accepts every op kind with known fields', () => {
    const ops: unknown[] = [
      { op: 'addNode', node: node('a') },
      { op: 'removeNode', id: 'a' },
      { op: 'moveNodes', moves: [{ id: 'a', x: 1, y: 2 }] },
      { op: 'connect', edge: { ...edge('e', 'a', 'b'), label: 'x' } },
      { op: 'disconnect', id: 'e' },
      { op: 'reconnect', id: 'e', from: { node: 'a', port: 'out' } },
      { op: 'setProps', id: 'a', label: 'A', props: {}, unset: [] },
      { op: 'group', group: { id: 'g', label: 'G' }, nodes: ['a'] },
      { op: 'ungroup', id: 'g' },
      { op: 'paste', fragment: { nodes: [node('b')], edges: [], groups: [] } },
    ];
    expect(parseWorkflowOps(ops)).toMatchObject({ ok: true });
  });

  it('refuses unknown kinds and unknown fields at any depth', () => {
    expect(parseWorkflowOp({ op: 'script', code: 'x' })).toMatchObject({
      ok: false,
      error: { path: '/op' },
    });
    expect(parseWorkflowOp({ op: 'toString' })).toMatchObject({ ok: false });
    expect(parseWorkflowOp({ op: 'removeNode', id: 'a', onclick: 'x' })).toMatchObject({
      ok: false,
      error: { path: '/onclick' },
    });
    expect(parseWorkflowOp({ op: 'addNode', node: { ...node('a'), html: '<b>' } })).toMatchObject({
      ok: false,
      error: { path: '/node/html' },
    });
    expect(
      parseWorkflowOp({
        op: 'paste',
        fragment: {
          nodes: [{ ...node('a'), position: { x: 0, y: 0, z: 1 } }],
          edges: [],
          groups: [],
        },
      })
    ).toMatchObject({ ok: false, error: { path: '/fragment/nodes/0/position/z' } });
    expect(parseWorkflowOps([{ op: 'removeNode', id: 'a' }, 7])).toMatchObject({
      ok: false,
      error: { opIndex: 1 },
    });
  });
});

describe('document', () => {
  it('round-trips through canonical JSON', () => {
    const graph = apply(pipeline(), [
      { op: 'group', group: { id: 'g', label: 'Checks' }, nodes: ['check'] },
      { op: 'setProps', id: 'fetch', props: { url: 'https://api.example.com', retries: 0 } },
    ]);
    const text = stringifyWorkflow(graph);
    const parsed = parseWorkflow(JSON.parse(text), context);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(stringifyWorkflow(parsed.graph)).toBe(text);
    expect(JSON.parse(text).version).toBe(WORKFLOW_SCHEMA_VERSION);
  });

  it('is independent of build order and writes keys in a fixed order', () => {
    const graph = pipeline();
    const shuffled: WorkflowGraph = {
      ...graph,
      nodes: [...graph.nodes].reverse().map((n) => ({
        position: { y: n.position.y, x: n.position.x },
        label: n.label,
        type: n.type,
        id: n.id,
      })),
      edges: [...graph.edges].reverse(),
    };
    expect(stringifyWorkflow(shuffled)).toBe(stringifyWorkflow(graph));
    expect(Object.keys(toWorkflowJson(graph).nodes[0] as object)).toEqual([
      'id',
      'type',
      'label',
      'position',
    ]);
    expect(
      stringifyWorkflow({ ...graph, nodes: [{ ...node('z'), position: { x: -0, y: 0 } }] })
    ).toContain('"position":{"x":0,"y":0}');
  });

  it('reports every problem with its path', () => {
    const parsed = parseWorkflow(
      {
        version: WORKFLOW_SCHEMA_VERSION,
        nodes: [node('a'), node('b', 'script'), { ...node('c'), label: 'x‮y' }],
        edges: [edge('e', 'a', 'b')],
      },
      context
    );
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.diagnostics.map((d) => [d.code, d.path])).toEqual([
      ['unknown-type', '/nodes/1/type'],
      ['unsafe-text', '/nodes/2/label'],
      ['unknown-id', '/edges/0/to/node'],
    ]);
  });

  it('finds a cycle edge in a document that forbids cycles', () => {
    const doc = {
      version: WORKFLOW_SCHEMA_VERSION,
      cycles: 'forbid',
      nodes: [node('a'), node('b'), node('c'), node('d')],
      edges: [
        edge('ab', 'a', 'b'),
        edge('bc', 'b', 'c'),
        edge('cb', 'c', 'b'),
        edge('cd', 'c', 'd'),
      ],
    };
    const parsed = parseWorkflow(doc, context);
    expect(!parsed.ok && parsed.diagnostics).toEqual([
      expect.objectContaining({ code: 'cycle', path: '/edges/1' }),
    ]);
    expect(parseWorkflow({ ...doc, cycles: 'allow' }, context).ok).toBe(true);
  });

  it('finds the cycle edge, not an edge downstream of it', () => {
    const edges = [
      edge('a1', 'x', 'y'),
      edge('z9', 'y', 'x'),
      edge('b0', 'y', 'w'),
      edge('b1', 'w', 'v'),
    ];
    const ids = ['v', 'w', 'x', 'y'];
    expect(findCycleEdge(ids, edges)).toBe('a1');
    expect(
      findCycleEdge(
        ids,
        edges.filter((e) => e.id !== 'z9')
      )
    ).toBeUndefined();
  });

  it('refuses oversized documents before walking them', () => {
    const nodes = Array.from({ length: 10_000 }, (_, i) => node(`n${i}`));
    const started = performance.now();
    const parsed = parseWorkflow({ version: WORKFLOW_SCHEMA_VERSION, nodes, edges: [] }, context);
    expect(performance.now() - started).toBeLessThan(50);
    expect(!parsed.ok && parsed.diagnostics).toEqual([
      expect.objectContaining({ code: 'limit', path: '/nodes' }),
    ]);
  });

  it('refuses unknown fields, versions and shapes', () => {
    const base = { version: WORKFLOW_SCHEMA_VERSION, nodes: [], edges: [] };
    const first = (input: unknown) => {
      const parsed = parseWorkflow(input, context);
      return parsed.ok ? undefined : parsed.diagnostics[0];
    };
    expect(first({ ...base, script: 'x' })).toMatchObject({ path: '/script' });
    expect(first({ ...base, version: '9' })).toMatchObject({ path: '/version' });
    expect(first({ ...base, cycles: 'sometimes' })).toMatchObject({ path: '/cycles' });
    expect(first({ ...base, nodes: {} })).toMatchObject({ path: '/nodes' });
    expect(first([])).toMatchObject({ path: '' });
    expect(first({ ...base, metadata: { owner: 'ops', bad: { nested: true } } })).toMatchObject({
      path: '/metadata',
    });
    expect(parseWorkflow({ ...base, metadata: { owner: 'ops@example.com' } }, context).ok).toBe(
      true
    );
  });

  it('publishes a draft JSON Schema with the same limits', () => {
    expect(WORKFLOW_JSON_SCHEMA.properties.nodes.maxItems).toBe(WORKFLOW_LIMITS.maxNodes);
    expect(WORKFLOW_JSON_SCHEMA.properties.edges.maxItems).toBe(WORKFLOW_LIMITS.maxEdges);
    expect(WORKFLOW_JSON_SCHEMA.properties.version.const).toBe(WORKFLOW_SCHEMA_VERSION);
    expect(WORKFLOW_LIMITS.maxNodes).toBe(500);
    expect(WORKFLOW_LIMITS.maxEdges).toBe(2000);
  });
});

describe('history', () => {
  it('undoes and redoes exact graphs and notifies listeners', () => {
    const history = createWorkflowHistory(pipeline(), context);
    const events: WorkflowEvent['type'][] = [];
    const stop = history.subscribe((event) => events.push(event.type));
    const start = history.graph;
    expect(history.apply({ op: 'removeNode', id: 'check' })).toMatchObject({
      ok: true,
      changed: true,
    });
    expect(history.canUndo).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.graph).toBe(start);
    expect(history.redo()).toBe(true);
    expect(history.graph.nodes).toHaveLength(4);
    stop();
    history.undo();
    expect(events).toEqual(['apply', 'undo', 'redo']);
    expect(history.redo()).toBe(true);
    expect(history.redo()).toBe(false);
  });

  it('coalesces a drag into one step with one merged move', () => {
    const history = createWorkflowHistory(pipeline(), context);
    const start = history.graph;
    for (let step = 1; step <= 50; step++) {
      history.apply(
        {
          op: 'moveNodes',
          moves: [
            { id: 'fetch', x: 200 + step, y: step },
            ...(step > 25 ? [{ id: 'check', x: 400, y: step }] : []),
          ],
        },
        { coalesceKey: 'drag-1' }
      );
    }
    history.apply({ op: 'setProps', id: 'fetch', label: 'Fetch' });
    history.undo();
    const listener = vi.fn();
    history.subscribe(listener);
    expect(history.undo()).toBe(true);
    expect(history.graph).toBe(start);
    expect(history.canUndo).toBe(false);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'undo',
        ops: [
          {
            op: 'moveNodes',
            moves: [
              { id: 'fetch', x: 200, y: 0 },
              { id: 'check', x: 400, y: 0 },
            ],
          },
        ],
      })
    );
    history.redo();
    expect(history.graph.nodes.find((n) => n.id === 'check')?.position).toEqual({ x: 400, y: 50 });
  });

  it('never merges after an undo, honors the commit gate and the step limit', () => {
    const gate = vi.fn((graph: WorkflowGraph) => ({
      ok: graph.nodes.length > 4,
      diagnostics: ['too small'],
    }));
    const history = createWorkflowHistory(pipeline(), { ...context, validate: gate, limit: 2 });
    expect(history.apply({ op: 'removeNode', id: 'done' })).toMatchObject({
      ok: false,
      error: { code: 'validation-failed', diagnostics: ['too small'] },
    });
    for (const x of [1, 2, 3])
      history.apply({ op: 'moveNodes', moves: [{ id: 'start', x, y: 0 }] });
    expect(history.undo() && history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    history.apply({ op: 'moveNodes', moves: [{ id: 'start', x: 9, y: 0 }] }, { coalesceKey: 'k' });
    expect(history.canRedo).toBe(false);
    history.clear();
    expect(history.canUndo).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property tests: random op sequences from a seeded generator.
// ---------------------------------------------------------------------------

function createRng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function randomOp(graph: WorkflowGraph, random: () => number, serial: () => string): WorkflowOp {
  const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(random() * list.length)];
  const types = ['trigger', 'http', 'branch', 'transform', 'sum', 'end'];
  const nodeIds = graph.nodes.map((n) => n.id);
  const someNode = () => pick(nodeIds) ?? 'none';
  const ports = (id: string, direction: 'in' | 'out') => {
    const type = graph.nodes.find((n) => n.id === id)?.type ?? '';
    return (
      registry
        .get(type)
        ?.ports.filter((p) => p.direction === direction)
        .map((p) => p.id) ?? []
    );
  };
  switch (Math.floor(random() * 10)) {
    case 0:
    case 1:
      return {
        op: 'addNode',
        node: {
          ...node(serial(), pick(types)),
          position: { x: Math.round(random() * 900), y: Math.round(random() * 600) },
        },
      };
    case 2:
      return { op: 'removeNode', id: someNode() };
    case 3:
      return {
        op: 'moveNodes',
        moves: [...new Set([someNode(), someNode()])].map((id) => ({
          id,
          x: Math.round(random() * 900),
          y: -5,
        })),
      };
    case 4:
    case 5: {
      const from = someNode();
      const to = someNode();
      return {
        op: 'connect',
        edge: edge(
          serial(),
          from,
          to,
          pick(ports(from, 'out')) ?? 'out',
          pick(ports(to, 'in')) ?? 'in'
        ),
      };
    }
    case 6:
      return random() < 0.5
        ? { op: 'disconnect', id: pick(graph.edges)?.id ?? 'none' }
        : {
            op: 'reconnect',
            id: pick(graph.edges)?.id ?? 'none',
            to: { node: someNode(), port: 'in' },
          };
    case 7:
      return random() < 0.5
        ? { op: 'setProps', id: someNode(), label: `L${serial()}` }
        : {
            op: 'setProps',
            id: someNode(),
            props: { retries: Math.floor(random() * 6) },
            unset: ['note'],
          };
    case 8:
      return random() < 0.5 || graph.groups.length === 0
        ? {
            op: 'group',
            group: { id: serial(), label: 'G' },
            nodes: [...new Set([someNode(), someNode()])],
          }
        : { op: 'ungroup', id: pick(graph.groups)?.id ?? 'none' };
    default:
      return {
        op: 'paste',
        fragment: prepareFragment(graph, copyFragment(graph, [someNode(), someNode()]), {
          offset: { x: 20, y: 20 },
        }),
      };
  }
}

describe('properties', () => {
  it('every applied op is undone exactly by its inverse (150 seeds × 40 ops)', () => {
    let applied = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const random = createRng(seed);
      let n = 0;
      const serial = () => `s${seed}-${n++}`;
      let graph = createWorkflow({ cycles: seed % 3 === 0 ? 'allow' : 'forbid' });
      for (let step = 0; step < 40; step++) {
        const op = randomOp(graph, random, serial);
        const result = applyWorkflowOp(graph, op, context);
        if (!result.ok) continue;
        applied++;
        const restored = applyWorkflowOps(result.graph, result.inverse, context);
        expect(restored.ok).toBe(true);
        expect(restored.ok && stringifyWorkflow(restored.graph)).toBe(stringifyWorkflow(graph));
        // Every graph the ops produce is a valid document.
        expect(parseWorkflow(JSON.parse(stringifyWorkflow(result.graph)), context).ok).toBe(true);
        graph = result.graph;
      }
    }
    expect(applied).toBeGreaterThan(3000);
  }, 30_000);

  it('history undo-all returns the start and redo-all the end (100 seeds)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const random = createRng(seed * 7919);
      let n = 0;
      const serial = () => `h${n++}`;
      const history = createWorkflowHistory(createWorkflow(), context);
      for (let step = 0; step < 40; step++) {
        const op = randomOp(history.graph, random, serial);
        history.apply(op, op.op === 'moveNodes' && random() < 0.5 ? { coalesceKey: 'drag' } : {});
      }
      const end = stringifyWorkflow(history.graph);
      while (history.undo()) {}
      expect(history.graph.nodes).toHaveLength(0);
      while (history.redo()) {}
      expect(stringifyWorkflow(history.graph)).toBe(end);
    }
  });

  it('a forbid-cycles graph never holds a cycle', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const random = createRng(seed * 31);
      let n = 0;
      const serial = () => `c${n++}`;
      let graph = createWorkflow();
      for (let step = 0; step < 60; step++) {
        const result = applyWorkflowOp(graph, randomOp(graph, random, serial), context);
        if (result.ok) graph = result.graph;
      }
      expect(
        findCycleEdge(
          graph.nodes.map((x) => x.id),
          graph.edges
        )
      ).toBeUndefined();
    }
  });
});
