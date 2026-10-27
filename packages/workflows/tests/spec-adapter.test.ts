// @vitest-environment node
import { describe, expect, it } from 'vitest';
// The spec's own validator checks the adapter's output against the interchange
// contract. Test-only: the package itself never imports @texuli/spec.
import workflowJson from '../../spec/schemas/workflow.schema.json';
import { validateWorkflowGraph } from '../../spec/src/workflow.ts';

const workflowSchema = workflowJson as unknown as Parameters<typeof validateWorkflowGraph>[1];

import {
  applyWorkflowOps,
  createWorkflow,
  defineNodeTypes,
  stringifyWorkflow,
  type WorkflowGraph,
  type WorkflowOp,
} from '../src/model/index.ts';
import {
  fromSpecWorkflow,
  type SpecWorkflowGraph,
  toSpecPath,
  toSpecWorkflow,
} from '../src/model/spec-adapter.ts';

const registry = defineNodeTypes([
  {
    type: 'trigger',
    label: 'Trigger',
    category: 'Start',
    ports: [{ id: 'out', direction: 'out', dataType: 'event' }],
    props: { schedule: { kind: 'enum', values: ['hourly', 'daily'] } },
  },
  {
    type: 'http',
    label: 'HTTP request',
    ports: [
      { id: 'in', direction: 'in', dataType: 'any', cardinality: 'one' },
      { id: 'out', direction: 'out', dataType: 'json' },
    ],
    props: {
      url: { kind: 'url' },
      retries: { kind: 'number', min: 0, max: 5 },
      note: { kind: 'text', maxLength: 80 },
    },
  },
  {
    type: 'end',
    label: 'End',
    ports: [{ id: 'in', direction: 'in', dataType: 'json' }],
    props: { notify: { kind: 'boolean' } },
  },
]);

function build(ops: WorkflowOp[], cycles: 'allow' | 'forbid' = 'forbid'): WorkflowGraph {
  const result = applyWorkflowOps(createWorkflow({ cycles }), ops, { registry });
  if (!result.ok) throw new Error(result.error.message);
  return result.graph;
}

const graph = build([
  {
    op: 'addNode',
    node: {
      id: 'start',
      type: 'trigger',
      label: 'Every hour',
      position: { x: 0, y: 0 },
      props: { schedule: 'hourly' },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'fetch',
      type: 'http',
      label: 'Fetch orders',
      position: { x: 260, y: 0 },
      props: { url: 'https://api.example.com/orders', retries: 2 },
      metadata: { locked: true, width: 220, height: 80 },
    },
  },
  {
    op: 'addNode',
    node: {
      id: 'done',
      type: 'end',
      label: 'Done',
      position: { x: 520, y: 0 },
      props: { notify: true },
    },
  },
  {
    op: 'connect',
    edge: { id: 'e1', from: { node: 'start', port: 'out' }, to: { node: 'fetch', port: 'in' } },
  },
  {
    op: 'connect',
    edge: {
      id: 'e2',
      from: { node: 'fetch', port: 'out' },
      to: { node: 'done', port: 'in' },
      label: 'ok',
    },
  },
  { op: 'group', group: { id: 'g', label: 'Intake' }, nodes: ['start', 'fetch'] },
]);

describe('toSpecWorkflow', () => {
  it('produces a graph the spec validator accepts', () => {
    const result = toSpecWorkflow(graph, registry, { viewport: { x: 0, y: 0, zoom: 1 } });
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateWorkflowGraph(result.graph, workflowSchema)).toEqual({
      ok: true,
      diagnostics: [],
    });
    const fetch = result.graph.nodes.find((node) => node.id === 'fetch');
    expect(fetch).toMatchObject({
      locked: true,
      size: { width: 220, height: 80 },
      data: { url: 'https://api.example.com/orders' },
    });
    expect(result.graph.cycles).toBe('forbid');
    const http = result.graph.nodeTypes.find((type) => type.id === 'http');
    expect(http?.ports).toEqual([
      { id: 'in', direction: 'in' },
      { id: 'out', direction: 'out', kind: 'json', multiple: true },
    ]);
    // URL kinds and number ranges have no spec counterpart: reported, not hidden.
    expect(result.dropped).toEqual(['/nodeTypes/1/fields/0/kind', '/nodeTypes/1/fields/1/kind']);
  });

  it('refuses what the spec cannot hold', () => {
    const odd = defineNodeTypes([
      {
        type: 'a',
        label: 'A',
        ports: [{ id: 'out', direction: 'out', dataType: 'JSON.Value' }],
        props: { Big: { kind: 'text' } },
      },
    ]);
    const result = toSpecWorkflow(createWorkflow(), odd);
    expect(!result.ok && result.diagnostics.map((d) => d.path)).toEqual([
      '/nodeTypes/0/ports/0/kind',
      '/nodeTypes/0/fields/0/name',
    ]);
    const c1 = build([
      {
        op: 'addNode',
        node: { id: 'x', type: 'end', label: 'bad\u0085label', position: { x: 0, y: 0 } },
      },
    ]);
    const refused = toSpecWorkflow(c1, registry);
    expect(!refused.ok && refused.diagnostics[0]).toMatchObject({
      code: 'unsafe-text',
      path: '/nodes/0/label',
    });
  });

  it('fills an empty label with the type label and reports it', () => {
    const blank = build([
      { op: 'addNode', node: { id: 'x', type: 'end', label: '', position: { x: 0, y: 0 } } },
    ]);
    const result = toSpecWorkflow(blank, registry);
    expect(result.ok && result.graph.nodes[0]?.label).toBe('End');
    expect(result.ok && result.dropped).toContain('/nodes/0/label');
  });
});

describe('fromSpecWorkflow', () => {
  it('round-trips through the spec with the host registry', () => {
    const spec = toSpecWorkflow(graph, registry);
    if (!spec.ok) throw new Error('spec');
    const back = fromSpecWorkflow(JSON.parse(JSON.stringify(spec.graph)), { registry });
    if (!back.ok) throw new Error(JSON.stringify(back.diagnostics));
    expect(stringifyWorkflow(back.graph)).toBe(stringifyWorkflow(graph));
    expect(back.registry).toBe(registry);
  });

  it('builds a closed registry from the document when the host has none', () => {
    const spec = toSpecWorkflow(graph, registry);
    if (!spec.ok) throw new Error('spec');
    const back = fromSpecWorkflow(spec.graph);
    if (!back.ok) throw new Error(JSON.stringify(back.diagnostics));
    expect(back.registry.types).toEqual(['trigger', 'http', 'end']);
    expect(back.registry.port('http', 'in')).toMatchObject({ dataType: 'any', cardinality: 'one' });
    expect(back.registry.get('http')?.props?.url).toEqual({ kind: 'text' });
    expect(back.graph.nodes).toHaveLength(3);
  });

  it('keeps the host registry in charge of untrusted documents', () => {
    const hostile: SpecWorkflowGraph = {
      version: 1,
      nodeTypes: [
        { id: 'script', label: 'Script', ports: [], fields: [{ name: 'code', kind: 'string' }] },
      ],
      nodes: [
        {
          id: 'x',
          type: 'script',
          label: 'Run',
          position: { x: 0, y: 0 },
          data: { code: 'alert(1)' },
        },
      ],
      edges: [],
    };
    const result = fromSpecWorkflow(hostile, { registry });
    expect(!result.ok && result.diagnostics[0]).toMatchObject({
      code: 'unknown-type',
      path: '$.nodes[0].type',
    });
  });

  it('applies the model checks: URL policy, cycles, limits and required fields', () => {
    const base = toSpecWorkflow(graph, registry);
    if (!base.ok) throw new Error('spec');
    const withUrl = structuredClone(base.graph);
    (withUrl.nodes[1] as { data: Record<string, unknown> }).data.url = 'javascript:alert(1)';
    const refused = fromSpecWorkflow(withUrl, { registry });
    expect(!refused.ok && refused.diagnostics[0]).toMatchObject({
      code: 'unsafe-url',
      path: '$.nodes[1].data.url',
    });
    const loop = structuredClone(base.graph);
    loop.edges.push({
      id: 'back',
      from: { node: 'fetch', port: 'out' },
      to: { node: 'fetch', port: 'in' },
    });
    expect(fromSpecWorkflow(loop, { registry }).ok).toBe(false);
    const big = {
      ...base.graph,
      nodes: Array.from({ length: 501 }, (_, i) => ({ ...base.graph.nodes[2], id: `n${i}` })),
    };
    expect(fromSpecWorkflow(big, { registry })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'limit' }],
    });
    const required: SpecWorkflowGraph = {
      version: 1,
      nodeTypes: [
        {
          id: 'mail',
          label: 'Mail',
          ports: [],
          fields: [{ name: 'to', kind: 'string', required: true }],
        },
      ],
      nodes: [{ id: 'm', type: 'mail', label: 'Mail', position: { x: 0, y: 0 } }],
      edges: [],
    };
    expect(fromSpecWorkflow(required)).toMatchObject({
      ok: false,
      diagnostics: [{ path: '$.nodes[0].data.to' }],
    });
  });

  it('reads the spec defaults: omitted cycles allow loops, viewport is clamped', () => {
    const doc: SpecWorkflowGraph = {
      version: 1,
      nodeTypes: [
        {
          id: 'step',
          label: 'Step',
          ports: [
            { id: 'in', direction: 'in' },
            { id: 'out', direction: 'out' },
          ],
        },
      ],
      nodes: [
        { id: 'a', type: 'step', label: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'step', label: 'B', position: { x: 1, y: 0 } },
      ],
      edges: [
        { id: 'ab', from: { node: 'a', port: 'out' }, to: { node: 'b', port: 'in' } },
        { id: 'ba', from: { node: 'b', port: 'out' }, to: { node: 'a', port: 'in' } },
      ],
      viewport: { x: 0, y: 0, zoom: 9 },
    };
    const result = fromSpecWorkflow(doc);
    expect(result.ok && result.graph.cycles).toBe('allow');
    expect(result.ok && result.viewport).toEqual({ x: 0, y: 0, zoom: 4 });
  });

  it('refuses malformed envelopes', () => {
    expect(fromSpecWorkflow(null)).toMatchObject({ ok: false, diagnostics: [{ path: '$' }] });
    expect(fromSpecWorkflow({ version: 2, nodeTypes: [], nodes: [], edges: [] })).toMatchObject({
      diagnostics: [{ path: '$.version' }],
    });
    expect(fromSpecWorkflow({ version: 1, nodeTypes: {}, nodes: [], edges: [] })).toMatchObject({
      diagnostics: [{ path: '$.nodeTypes' }],
    });
    expect(toSpecPath('/nodes/3/props/url')).toBe('$.nodes[3].data.url');
    expect(toSpecPath('/edges/0/to/node')).toBe('$.edges[0].to.node');
  });
});
