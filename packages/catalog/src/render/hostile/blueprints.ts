/**
 * Hostile spec 0.3.0 blueprints (data only): workflow graphs, drag as data,
 * bindings and actions. Each must be refused by `validateDraft` with the
 * host's spec check (`checkSpec: validateBlueprint`), naming at least one of
 * `refuse`; nothing is ever evaluated. `make` builds the large cases on
 * demand, so importing the corpus stays cheap.
 */

export type HostileBlueprintCategory =
  | 'workflow-cycle'
  | 'workflow-size'
  | 'bidi'
  | 'script-url'
  | 'reorder'
  | 'unknown-id'
  | 'unknown-prop'
  | 'unknown-action'
  | 'binding'
  | 'prototype';

export interface HostileBlueprint {
  id: string;
  category: HostileBlueprintCategory;
  title: string;
  /** The tree of a version-1 envelope (the runner wraps it); or `make` builds one. */
  tree?: unknown;
  /** Envelope `state` declarations. */
  state?: Readonly<Record<string, unknown>>;
  /** Builds a large tree on demand. */
  make?: () => unknown;
  /** Raw JSON text of the whole envelope, for shapes an object literal cannot hold. */
  text?: string;
  /**
   * Diagnostic codes, at least one of which the refusal must name. Empty
   * means the blueprint is valid and must be neutralized instead: it passes,
   * and every rendered string stays inert text.
   */
  refuse: readonly string[];
}

const step = {
  id: 'step',
  label: 'Step',
  ports: [
    { id: 'in', direction: 'in', multiple: true },
    { id: 'out', direction: 'out', multiple: true },
  ],
};

const node = (id: string, label = id) => ({ id, type: 'step', label, position: { x: 0, y: 0 } });
const edge = (id: string, from: string, to: string) => ({
  id,
  from: { node: from, port: 'out' },
  to: { node: to, port: 'in' },
});
const graph = (nodes: unknown[], edges: unknown[], cycles = 'forbid') => ({
  id: 'workflow-graph',
  props: {
    label: 'Hostile workflow',
    graph: { version: 1, cycles, nodeTypes: [step], nodes, edges },
  },
});

export const HOSTILE_BLUEPRINTS: readonly HostileBlueprint[] = Object.freeze([
  {
    id: 'workflow-forbidden-cycle',
    category: 'workflow-cycle',
    title: 'A cycle in a workflow that forbids cycles',
    tree: graph([node('a'), node('b')], [edge('ab', 'a', 'b'), edge('ba', 'b', 'a')]),
    refuse: ['workflow'],
  },
  {
    id: 'workflow-self-loop',
    category: 'workflow-cycle',
    title: 'A self-loop counts as a cycle',
    tree: graph([node('a')], [edge('aa', 'a', 'a')]),
    refuse: ['workflow'],
  },
  {
    id: 'workflow-10000-nodes',
    category: 'workflow-size',
    title: '10,000 workflow nodes (the cap is 500)',
    make: () =>
      graph(
        Array.from({ length: 10_000 }, (_, i) => node(`n${i}`)),
        []
      ),
    refuse: ['too-large', 'too-many-nodes', 'prop-type', 'schema'],
  },
  {
    id: 'workflow-bidi-label',
    category: 'bidi',
    title: 'A bidi override in a workflow node label',
    tree: graph([node('a', 'pay\u202Eyas')], []),
    refuse: ['prop-type'],
  },
  {
    id: 'workflow-dangling-edge',
    category: 'unknown-id',
    title: 'An edge to a node that does not exist',
    tree: graph([node('a')], [edge('ax', 'a', 'ghost')]),
    refuse: ['workflow'],
  },
  {
    id: 'workflow-javascript-label',
    category: 'script-url',
    title: 'javascript: in workflow node text: the raw sink scan refuses it at the untrusted tier',
    tree: graph([node('a', 'javascript:alert(1)')], []),
    refuse: ['sink'],
  },
  {
    id: 'reorder-oversized-locked',
    category: 'reorder',
    title: 'reorder.locked past its 500-item bound',
    state: { tasks: { type: 'list' } },
    tree: {
      id: 'sortable-list',
      props: {
        label: 'Tasks',
        reorder: {
          bind: { $state: 'tasks' },
          locked: Array.from({ length: 600 }, (_, i) => `t${i}`),
        },
      },
    },
    refuse: ['prop-type'],
  },
  {
    id: 'reorder-bidi-item',
    category: 'bidi',
    title: 'A right-to-left override in a draggable list item, spoofing a file extension',
    state: {
      tasks: { type: 'list', initial: [{ id: 't1', label: 'Invoice \u202Eexe.pdf' }] },
    },
    tree: {
      id: 'sortable-list',
      props: { label: 'Tasks', reorder: { bind: { $state: 'tasks' }, group: 'tasks' } },
    },
    refuse: ['state'],
  },
  {
    id: 'reorder-zero-width-item',
    category: 'bidi',
    title: 'A zero-width space hiding inside a draggable list item',
    state: { tasks: { type: 'list', initial: [{ id: 't1', label: 'Pay\u200Bnow' }] } },
    tree: {
      id: 'sortable-list',
      props: { label: 'Tasks', reorder: { bind: { $state: 'tasks' } } },
    },
    refuse: ['state'],
  },
  {
    id: 'form-field-outside-form',
    category: 'unknown-action',
    title: 'A form field outside any action-form (the player refuses it; so do the validators)',
    state: { email: { type: 'string' } },
    tree: { id: 'form-field', props: { name: 'email', label: 'Email', state: 'email' } },
    refuse: ['action'],
  },
  {
    id: 'reorder-undeclared-list',
    category: 'reorder',
    title: 'reorder binds a list that is not declared',
    tree: { id: 'sortable-list', props: { label: 'Tasks', reorder: { bind: { $state: 'nope' } } } },
    refuse: ['unknown-state'],
  },
  {
    id: 'reorder-extra-field',
    category: 'reorder',
    title: 'reorder with an unknown field (a script hook)',
    state: { tasks: { type: 'list' } },
    tree: {
      id: 'sortable-list',
      props: { label: 'Tasks', reorder: { bind: { $state: 'tasks' }, onDrop: 'alert(1)' } },
    },
    refuse: ['prop-type'],
  },
  {
    id: 'action-unknown-op',
    category: 'unknown-action',
    title: 'An action outside the closed set',
    tree: {
      id: 'flow-action',
      props: { event: 'next', label: 'Go' },
      on: { press: [{ op: 'eval', code: 'alert(1)' }] },
    },
    refuse: ['action'],
  },
  {
    id: 'action-extra-field',
    category: 'unknown-action',
    title: 'A closed action with a smuggled field',
    state: { open: { type: 'boolean' } },
    tree: {
      id: 'flow-action',
      props: { event: 'next', label: 'Go' },
      on: { press: [{ op: 'toggleState', state: 'open', href: 'javascript:alert(1)' }] },
    },
    refuse: ['action'],
  },
  {
    id: 'event-not-fired',
    category: 'unknown-action',
    title: 'An event the component never fires',
    tree: { id: 'flow-view', props: { name: 'a' }, on: { press: [{ op: 'submit' }] } },
    refuse: ['unknown-event'],
  },
  {
    id: 'bind-not-bindable',
    category: 'binding',
    title: 'bind on a prop the component does not declare bindable',
    state: { label: { type: 'string' } },
    tree: { id: 'data-files', props: { entries: [] }, bind: { label: { $state: 'label' } } },
    refuse: ['binding'],
  },
  {
    id: 'data-binding-nested',
    category: 'binding',
    title: '$data inside an array (only whole top-level props may read host data)',
    tree: {
      id: 'data-board',
      props: {
        label: 'Board',
        columns: [{ id: 'a', title: { $data: 'secrets.token' } }],
        items: [],
      },
    },
    refuse: ['binding'],
  },
  {
    id: 'binding-two-keys',
    category: 'binding',
    title: 'A binding with a second key',
    state: { q: { type: 'string' } },
    tree: { id: 'control-filter', props: { state: 'q', label: { $state: 'q', $data: 'x' } } },
    refuse: ['binding'],
  },
  {
    id: 'unknown-node-field',
    category: 'unknown-prop',
    title: 'A node field outside id, props, children, slot, when, bind and on',
    tree: { id: 'data-map', props: { label: 'Map', markers: [] }, script: 'alert(1)' },
    refuse: ['unknown-field'],
  },
  {
    id: 'unknown-data-view-id',
    category: 'unknown-id',
    title: 'An id that is not in the catalog',
    tree: { id: 'iframe-embed', props: { src: 'https://evil.example' } },
    refuse: ['unknown-id'],
  },
  {
    id: 'board-item-extra-field',
    category: 'unknown-prop',
    title: 'A board card with a field outside its schema',
    tree: {
      id: 'data-board',
      props: {
        label: 'Board',
        columns: [{ id: 'a', title: 'A' }],
        items: [{ id: 'x', title: 'X', column: 'a', onclick: 'alert(1)' }],
      },
    },
    refuse: ['prop-type'],
  },
  {
    id: 'state-prototype-key',
    category: 'prototype',
    title: 'A __proto__ key among the state declarations',
    text: '{"format":"texuli-blueprint","version":1,"id":"hostile","catalog":"__CATALOG__","status":"draft","createdAt":"2026-10-27T09:00:00Z","updatedAt":"2026-10-27T09:00:00Z","generator":{"kind":"agent","name":"Hostile"},"state":{"__proto__":{"type":"boolean"}},"tree":{"id":"layout-stack","props":{}}}',
    refuse: ['prototype-key', 'state', 'schema'],
  },
]);
