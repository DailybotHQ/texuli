// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SpecCatalog, SpecComponent } from '../src/catalog.ts';
import { checkConformance } from '../src/conformance.ts';
import { contractRoot, SPEC_PATTERNS } from '../src/contract.ts';
import type { Schema } from '../src/dialect.ts';
import { LIST_TEXT_PATTERN, SURFACE_INTENT_NAME } from '../src/surface.ts';
import { type SpecDocuments, validateBlueprint, validateTree } from '../src/validate.ts';
import { validateWorkflowGraph } from '../src/workflow.ts';
import { committedOutputs, json, normative } from './helpers.ts';

/**
 * The 0.3.0 interaction contract (ADR-008): local state and flow, bindings,
 * two-way `bind`, `on` events with the closed actions, property schemas
 * (reorder and workflow graphs), deprecation warnings and the conformance
 * checks on the catalog. Each family is one table-driven test.
 */

type Bag = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
const blueprintSchema = json<Schema>('schemas/blueprint.schema.json');
const workflowSchema = json<Schema>('schemas/workflow.schema.json');
const realCatalog = json<SpecCatalog>('catalog/components.json');
const pipeline = json<Bag>('fixtures/workflow/golden/pipeline.json');
const golden = json<Bag>('fixtures/golden/report-on-demand.json');

const component = (id: string, extra: Partial<SpecComponent> = {}): SpecComponent => ({
  id,
  label: id,
  summary: id,
  group: 'test',
  placement: 'app',
  emit: ['developer', 'untrusted'],
  capability: 'unknown',
  props: [],
  ...extra,
});

/** A board with a reorder column schema, a workflow graph prop and an opaque object. */
const catalog: SpecCatalog = {
  catalogHash: realCatalog.catalogHash,
  components: [
    component('test-board', {
      events: ['change', 'move', 'press', 'select'],
      bindable: ['choice', 'open', 'title'],
      props: [
        {
          name: 'choice',
          kind: 'enum',
          enumValues: ['a', 'b'],
        },
        {
          name: 'columns',
          kind: 'array',
          schema: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', maxLength: 64 },
                title: { type: 'string' },
                cards: { $ref: '#/$defs/reorder' },
              },
              required: ['id', 'title', 'cards'],
            },
          },
        },
        { name: 'graph', kind: 'object', schema: { $ref: '#/$defs/workflowGraph' } },
        { name: 'meta', kind: 'object' },
        { name: 'open', kind: 'boolean' },
        { name: 'title', kind: 'string' },
      ],
    }),
    component('action-form', {
      props: [
        { name: 'action', kind: 'string', required: true },
        { name: 'children', kind: 'slot', extension: 'web' },
        { name: 'label', kind: 'string', required: true },
      ],
    }),
    component('test-button', {
      events: ['press'],
      props: [{ name: 'label', kind: 'string', required: true }],
    }),
    component('test-old', {
      deprecated: { since: '0.3.0', replacement: 'test-board' },
      props: [{ name: 'note', kind: 'string', deprecated: { since: '0.3.0' } }],
    }),
  ],
};

const state = {
  open: { type: 'boolean' },
  count: { type: 'number', min: 0, max: 10, initial: 2 },
  tab: { type: 'enum', values: ['a', 'b'] },
  title: { type: 'string', maxLength: 80, initial: 'Board' },
  todo: {
    type: 'list',
    initial: [
      { id: 't1', title: 'Write the brief' },
      { id: 't2', title: 'Ship', done: false },
    ],
  },
  doneList: { type: 'list', maxItems: 10 },
  feed: { type: 'string', source: 'tickets.title' },
  graph: { type: 'workflow', initial: pipeline },
};
const flow = {
  views: ['edit', 'review'],
  transitions: [
    { from: 'edit', to: 'review', on: 'next' },
    {
      from: '*',
      to: 'edit',
      on: 'back',
      when: { op: 'eq', left: { op: 'var', name: 'count' }, right: { op: 'num', value: 2 } },
    },
  ],
};
const tree = {
  id: 'test-board',
  props: {
    title: { $state: 'title' },
    columns: [
      {
        id: 'c1',
        title: 'Todo',
        cards: { bind: { $state: 'todo' }, group: 'cards', accepts: ['cards'], locked: ['t1'] },
      },
      { id: 'c2', title: 'Done', cards: { bind: { $state: 'doneList' }, group: 'cards' } },
    ],
    graph: pipeline,
    meta: { owner: { $state: 'feed' } },
  },
  bind: { open: { $state: 'open' }, choice: { $state: 'tab' } },
  on: {
    move: [{ op: 'moveItem', from: 'todo', to: 'doneList', item: 't2', index: 0 }],
    change: [{ op: 'setState', state: 'count', fromEvent: 'value' }],
    press: [
      { op: 'toggleState', state: 'open' },
      { op: 'flowGo', event: 'next' },
      { op: 'emit', intent: 'board-saved', values: { count: { $state: 'count' }, ok: true } },
    ],
    select: [{ op: 'setState', state: 'tab', value: 'b' }],
  },
  children: [
    {
      id: 'action-form',
      props: { action: 'save-board', label: 'Save' },
      children: [
        { id: 'test-button', props: { label: 'Save' }, on: { press: [{ op: 'submit' }] } },
      ],
    },
  ],
};

const envelope = (patch: (e: Bag & { tree: Bag; state: Bag }) => void = () => {}): Bag => {
  const e = {
    ...clone(golden),
    spec: '0.3.0',
    state: clone(state),
    flow: clone(flow),
    tree: clone(tree),
  };
  patch(e as Bag & { tree: Bag; state: Bag });
  return e;
};
const documents = { blueprintSchema, catalog, workflowSchema, validateWorkflowGraph };
const found = (input: unknown, docs: SpecDocuments = documents) =>
  validateBlueprint(input, docs).diagnostics.map((d) => `${d.code} ${d.path}`);

describe('a stateful 0.3.0 envelope', () => {
  it('validates on the real catalog and on a catalog with events, bindable props and schemas', () => {
    const real = {
      ...clone(golden),
      spec: '0.3.0',
      state: { heading: { type: 'string', initial: 'Week 42' }, compact: { type: 'boolean' } },
      flow: { views: ['summary'], transitions: [] },
      tree: {
        id: 'layout-doc',
        props: { title: { $state: 'heading' }, toc: { $state: 'compact' } },
      },
    };
    expect(validateBlueprint(real, { blueprintSchema, catalog: realCatalog })).toEqual({
      ok: true,
      diagnostics: [],
    });
    expect(found(envelope())).toEqual([]);
    // Host data reads a whole scalar prop.
    expect(
      found(envelope((e) => ((e.tree.props as Bag).title = { $data: 'tickets.title' })))
    ).toEqual([]);
  });
});

describe('state and flow declarations', () => {
  it('refuses bad names, fields, ranges, lists, workflows and flow references', () => {
    const cases: [string, (e: Bag & { tree: Bag; state: Bag }) => void, string[]][] = [
      ['a bad name', (e) => (e.state.Bad = { type: 'boolean' }), ['state $.state.Bad']],
      [
        'min above max',
        (e) => (e.state.count = { type: 'number', min: 5, max: 1 }),
        ['state $.state.count'],
      ],
      [
        'a field of another type',
        (e) => (e.state.open = { type: 'boolean', maxLength: 3 }),
        ['state $.state.open.maxLength'],
      ],
      [
        'an initial outside the values',
        (e) => (e.state.tab = { type: 'enum', values: ['a'], initial: 'z' }),
        ['state $.state.tab.initial'],
      ],
      [
        'a duplicate list item',
        (e) => (e.state.todo = { type: 'list', initial: [{ id: 'x' }, { id: 'x' }] }),
        ['state $.state.todo.initial[1].id'],
      ],
      [
        'a host-bound list',
        (e) => (e.state.doneList = { type: 'list', source: 'tickets.done' }),
        ['state $.state.doneList.source'],
      ],
      [
        'a workflow initial with a dangling edge',
        (e) => {
          const graph = clone(pipeline) as { edges: Bag[] };
          (graph.edges[0] as { to: Bag }).to = { node: 'nowhere', port: 'in' };
          e.state.graph = { type: 'workflow', initial: graph };
          (e.tree.props as Bag).graph = clone(pipeline);
        },
        ['workflow $.state.graph.initial.edges[0].to.node'],
      ],
      [
        'a transition to an undeclared view',
        (e) => ((e.flow as typeof flow).transitions[0] = { from: 'edit', to: 'gone', on: 'next' }),
        ['state $.flow.transitions[0].to'],
      ],
      [
        'repeated views',
        (e) => ((e.flow as typeof flow).views = ['edit', 'edit', 'review']),
        ['state $.flow.views'],
      ],
    ];
    for (const [label, patch, expected] of cases)
      expect(found(envelope(patch)), label).toEqual(expected);
    // Workflow state and props fail closed without the workflow schema or without its validator.
    for (const docs of [
      { blueprintSchema, catalog, validateWorkflowGraph },
      { blueprintSchema, catalog, workflowSchema },
    ]) {
      expect(found(envelope(), docs)).toEqual([
        'state $.state.graph.initial',
        'prop-type $.tree.props.graph',
      ]);
    }
    // So does validateTree on a caller-built root that names workflowGraph.
    const tree = envelope().tree;
    const root = contractRoot(blueprintSchema, workflowSchema);
    expect(validateTree(tree, catalog, { root }).map((d) => `${d.code} ${d.path}`)).toContain(
      'prop-type $.props.graph'
    );
    // At most 64 variables.
    const many = envelope((e) => {
      for (let i = 0; i < 60; i += 1) e.state[`extra${i}`] = { type: 'boolean' };
    });
    expect(found(many)).toEqual(['state $.state']);
  });
});

describe('bindings, bind and property schemas', () => {
  it('reports unknown state, bad shapes, host data placement, fit, bindability and reorder lists', () => {
    const props = (e: Bag & { tree: Bag }) => e.tree.props as Bag;
    const columns = (e: Bag & { tree: Bag }) =>
      props(e).columns as { cards: Bag; title?: string }[];
    const cases: [string, (e: Bag & { tree: Bag; state: Bag }) => void, string[]][] = [
      [
        'an undeclared variable',
        (e) => (props(e).title = { $state: 'nope' }),
        ['unknown-state $.tree.props.title'],
      ],
      [
        'two keys',
        (e) => (props(e).title = { $state: 'title', $data: 'x' }),
        ['binding $.tree.props.title'],
      ],
      [
        'host data on an array prop',
        (e) => (props(e).columns = { $data: 'board.columns' }),
        ['binding $.tree.props.columns'],
      ],
      [
        'a variable of another type',
        (e) => (props(e).title = { $state: 'count' }),
        ['binding $.tree.props.title'],
      ],
      [
        'nested host data and an unknown nested variable',
        (e) => (props(e).meta = { a: { $data: 'x' }, b: [{ $state: 'nope' }] }),
        ['binding $.tree.props.meta.a', 'unknown-state $.tree.props.meta.b[0]'],
      ],
      [
        'a binding that does not fit its schema position',
        (e) => (columns(e)[0] = { ...columns(e)[0], title: { $state: 'count' } } as never),
        ['binding $.tree.props.columns[0].title'],
      ],
      [
        'a column without a title',
        (e) => delete columns(e)[0]?.title,
        ['prop-type $.tree.props.columns[0].title'],
      ],
      [
        'reorder bound to a number',
        (e) => ((columns(e)[0] as { cards: Bag }).cards.bind = { $state: 'count' }),
        ['binding $.tree.props.columns[0].cards.bind'],
      ],
      [
        'reorder bound to host data',
        (e) => ((columns(e)[0] as { cards: Bag }).cards.bind = { $data: 'board.todo' }),
        ['binding $.tree.props.columns[0].cards.bind'],
      ],
      [
        'reorder bound to an undeclared list',
        (e) => ((columns(e)[0] as { cards: Bag }).cards.bind = { $state: 'nope' }),
        ['unknown-state $.tree.props.columns[0].cards.bind'],
      ],
      [
        'bind on a prop that is not bindable',
        (e) => ((e.tree.bind as Bag).columns = { $state: 'todo' }),
        ['binding $.tree.bind.columns'],
      ],
      [
        'bind to host data',
        (e) => ((e.tree.bind as Bag).open = { $data: 'x' }),
        ['binding $.tree.bind.open'],
      ],
      [
        'bind to a host-bound variable',
        (e) => {
          delete props(e).title;
          (e.tree.bind as Bag).title = { $state: 'feed' };
        },
        ['binding $.tree.bind.title'],
      ],
      [
        'bind and a prop at once',
        (e) => ((e.tree.bind as Bag).title = { $state: 'title' }),
        ['binding $.tree.bind.title'],
      ],
      [
        'bind of another type',
        (e) => ((e.tree.bind as Bag).open = { $state: 'tab' }),
        ['binding $.tree.bind.open'],
      ],
    ];
    for (const [label, patch, expected] of cases)
      expect(found(envelope(patch)), label).toEqual(expected);
  });

  it('checks workflow graph props at scale and fails closed without the workflow schema', () => {
    const graph = (count: number) => {
      const nodes = Array.from({ length: count }, (_, i) => ({
        id: `n${i}`,
        type: 'step',
        label: `Step ${i}`,
        position: { x: i * 10, y: 0 },
      }));
      const edges: Bag[] = [];
      const linked = Math.min(count, 500);
      for (let k = 1; k < linked && edges.length < 2000; k += 1) {
        for (let i = 0; i + k < linked && edges.length < 2000; i += 1) {
          edges.push({
            id: `e${edges.length}`,
            from: { node: `n${i}`, port: 'out' },
            to: { node: `n${i + k}`, port: 'in' },
          });
        }
      }
      return {
        version: 1,
        cycles: 'forbid',
        nodeTypes: [
          {
            id: 'step',
            label: 'Step',
            ports: [
              { id: 'in', direction: 'in', multiple: true },
              { id: 'out', direction: 'out', multiple: true },
            ],
          },
        ],
        nodes,
        edges,
      };
    };
    expect(validateWorkflowGraph(graph(500), workflowSchema)).toEqual({
      ok: true,
      diagnostics: [],
    });
    expect(
      validateWorkflowGraph(graph(501), workflowSchema).diagnostics.map(
        (d) => `${d.code} ${d.path}`
      )
    ).toEqual(['schema $.nodes']);
    // Hostile labels: bidi overrides and controls are schema errors.
    const hostile = graph(2);
    (hostile.nodes[0] as Bag).label = `Pay ${String.fromCodePoint(0x202e)}eulav`;
    expect(validateWorkflowGraph(hostile, workflowSchema).diagnostics[0]?.code).toBe('schema');
    const cases: [string, (e: Bag & { tree: Bag }) => void, string[]][] = [
      [
        'a duplicate edge',
        (e) => (((e.tree.props as { graph: { edges: Bag[] } }).graph.edges[1] as Bag).id = 'e1'),
        ['workflow $.tree.props.graph.edges[1].id'],
      ],
      [
        'a graph past the schema',
        (e) => ((e.tree.props as { graph: Bag }).graph.version = 2),
        ['prop-type $.tree.props.graph.version'],
      ],
    ];
    for (const [label, patch, expected] of cases)
      expect(found(envelope(patch)), label).toEqual(expected);
  });
});

describe('events and the closed actions', () => {
  it('reports unknown events and each action op with its exact path', () => {
    const on = (e: Bag & { tree: Bag }) => e.tree.on as Record<string, Bag[]>;
    const cases: [string, (e: Bag & { tree: Bag; state: Bag }) => void, string[]][] = [
      [
        'an event the component lacks',
        (e) => (on(e).dismiss = [{ op: 'toggleState', state: 'open' }]),
        ['unknown-event $.tree.on.dismiss'],
      ],
      [
        'a field the op does not take',
        (e) => (on(e).press = [{ op: 'toggleState', state: 'open', value: true }]),
        ['action $.tree.on.press[0].value'],
      ],
      [
        'a missing field',
        (e) => (on(e).move = [{ op: 'moveItem', from: 'todo' }]),
        ['action $.tree.on.move[0].item'],
      ],
      [
        'setState out of range',
        (e) => (on(e).select = [{ op: 'setState', state: 'count', value: 11 }]),
        ['action $.tree.on.select[0].value'],
      ],
      [
        'setState with value and fromEvent',
        (e) => (on(e).select = [{ op: 'setState', state: 'tab', value: 'a', fromEvent: 'value' }]),
        ['action $.tree.on.select[0]'],
      ],
      [
        'setState on a list',
        (e) => (on(e).select = [{ op: 'setState', state: 'todo', value: [] }]),
        ['action $.tree.on.select[0].state'],
      ],
      [
        'fromEvent on press',
        (e) => (on(e).press = [{ op: 'setState', state: 'tab', fromEvent: 'value' }]),
        ['action $.tree.on.press[0].fromEvent'],
      ],
      [
        'toggleState on an enum',
        (e) => (on(e).press = [{ op: 'toggleState', state: 'tab' }]),
        ['action $.tree.on.press[0].state'],
      ],
      [
        'toggleState on host data',
        (e) => (on(e).press = [{ op: 'toggleState', state: 'feed' }]),
        ['action $.tree.on.press[0].state'],
      ],
      [
        'moveItem into a number',
        (e) => (on(e).move = [{ op: 'moveItem', from: 'todo', to: 'count', item: 't1' }]),
        ['action $.tree.on.move[0].to'],
      ],
      [
        'moveItem from nowhere',
        (e) => (on(e).move = [{ op: 'moveItem', from: 'nope', item: 't1' }]),
        ['unknown-state $.tree.on.move[0].from'],
      ],
      [
        'flowGo on an unhandled event',
        (e) => (on(e).press = [{ op: 'flowGo', event: 'skip' }]),
        ['action $.tree.on.press[0].event'],
      ],
      [
        'flowGo without a flow',
        (e) => {
          delete e.flow;
          on(e).press = [{ op: 'flowGo', event: 'next' }];
        },
        ['action $.tree.on.press[0]'],
      ],
      [
        'emit host data',
        (e) => (on(e).press = [{ op: 'emit', intent: 'save', values: { a: { $data: 'x' } } }]),
        ['action $.tree.on.press[0].values.a'],
      ],
      [
        'emit a list',
        (e) => (on(e).press = [{ op: 'emit', intent: 'save', values: { a: { $state: 'todo' } } }]),
        ['action $.tree.on.press[0].values.a'],
      ],
      [
        'emit a long string',
        (e) => (on(e).press = [{ op: 'emit', intent: 'save', values: { a: 'x'.repeat(2049) } }]),
        ['action $.tree.on.press[0].values.a'],
      ],
      [
        'emit an unknown variable',
        (e) => (on(e).press = [{ op: 'emit', intent: 'save', values: { a: { $state: 'nope' } } }]),
        ['unknown-state $.tree.on.press[0].values.a'],
      ],
      [
        'submit outside a form',
        (e) => (on(e).press = [{ op: 'submit' }]),
        ['action $.tree.on.press[0]'],
      ],
      [
        'an op outside the closed set',
        (e) => (on(e).press = [{ op: 'eval', code: '1' }]),
        ['schema $.tree.on.press[0].op', 'schema $.tree.on.press[0].code'],
      ],
    ];
    for (const [label, patch, expected] of cases)
      expect(found(envelope(patch)), label).toEqual(expected);
  });
});

describe('deprecation and catalog conformance', () => {
  it('warns on deprecated ids and props, and flags bad schemas, refs, collisions and expiry', () => {
    const old = { ...clone(golden), tree: { id: 'test-old', props: { note: 'x' } } };
    const result = validateBlueprint(old, documents);
    expect(result.ok).toBe(true);
    expect(result.warnings?.map((w) => `${w.code} ${w.path}`)).toEqual([
      'deprecated $.tree.id',
      'deprecated $.tree.props.note',
    ]);
    const committed = committedOutputs();
    const withCatalog = (edit: (c: SpecCatalog) => void) => {
      const next = clone(realCatalog);
      edit(next);
      return { ...normative, 'catalog/components.json': JSON.stringify(next) };
    };
    const checks = (files: Record<string, string>) =>
      checkConformance(files, committed)
        .filter((i) => !['manifest', 'generated', 'catalog'].includes(i.check))
        .map((i) => i.check);
    const first = (c: SpecCatalog) => c.components[0] as SpecComponent;
    const cases: [string, Record<string, string>, string[]][] = [
      [
        'a schema requiring an undeclared property',
        withCatalog((c) => {
          (first(c).props as SpecComponent['props'][number][]).push({
            name: 'rows',
            kind: 'array',
            schema: { type: 'array', items: { type: 'object', properties: {}, required: ['id'] } },
          });
        }),
        ['prop-schema'],
      ],
      [
        'a $ref outside the contract',
        withCatalog((c) => {
          (first(c).props as SpecComponent['props'][number][]).push({
            name: 'rows',
            kind: 'object',
            schema: { $ref: '#/$defs/node' },
          });
        }),
        ['prop-schema'],
      ],
      [
        'a schema on a string prop',
        withCatalog((c) => {
          (first(c).props as SpecComponent['props'][number][]).push({
            name: 'rows',
            kind: 'string',
            schema: { type: 'string' },
          });
        }),
        ['prop-schema'],
      ],
      [
        'an expired deprecation',
        withCatalog((c) => {
          first(c).deprecated = { since: '0.2.0' };
        }),
        ['deprecation'],
      ],
      [
        'a $defs collision',
        (() => {
          const schema = clone(workflowSchema) as { $defs: Record<string, Schema> };
          schema.$defs.node = { type: 'string' };
          return { ...normative, 'schemas/workflow.schema.json': JSON.stringify(schema) };
        })(),
        ['contract'],
      ],
    ];
    for (const [label, files, expected] of cases) expect(checks(files), label).toEqual(expected);
  });
});

describe('the state surface module', () => {
  it('compiles the contract patterns it copies to stay import-free', () => {
    expect(SURFACE_INTENT_NAME.source).toBe(SPEC_PATTERNS.intentName);
    expect(LIST_TEXT_PATTERN).toBe(SPEC_PATTERNS.listText);
  });
});
