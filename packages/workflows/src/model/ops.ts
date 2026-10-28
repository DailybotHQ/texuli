import { findCycleEdge } from './cycles.ts';
import { GraphDraft } from './draft.ts';
import type { NodeTypeRegistry } from './registry.ts';
import type {
  NodeMove,
  PortRef,
  WorkflowEdge,
  WorkflowError,
  WorkflowGraph,
  WorkflowGroup,
  WorkflowLimits,
  WorkflowNode,
  WorkflowOp,
  WorkflowResult,
  WorkflowScalar,
} from './types.ts';
import {
  type Checked,
  checkCoordinate,
  checkMetadata,
  checkPropValue,
  checkText,
  defineEntry,
  failure,
  isPlainRecord,
  isPropName,
  isWorkflowId,
  resolveLimits,
} from './values.ts';

/** What every op needs: the closed node-type registry and optional lower limits. */
export interface WorkflowContext {
  registry: NodeTypeRegistry;
  limits?: Partial<WorkflowLimits>;
}

type Applied =
  | { ok: true; inverse: WorkflowOp[]; changed: boolean }
  | { ok: false; error: WorkflowError };

function at<T>(result: Checked<T>, path: string): Checked<T> {
  if (result.ok) return result;
  return { ok: false, error: { ...result.error, path: path + (result.error.path ?? '') } };
}

function fail(code: WorkflowError['code'], message: string, path?: string): Applied {
  return failure(code, message, path);
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Reading values: every node and edge is rebuilt from known keys only.
// ---------------------------------------------------------------------------

/** Validate a node against the registry and the draft. Returns a clean copy. */
export function readNode(input: unknown, draft: GraphDraft): Checked<WorkflowNode> {
  const { registry, limits } = draft;
  if (!isPlainRecord(input)) return failure('invalid-value', 'A node must be an object.');
  if (!isWorkflowId(input.id)) return failure('invalid-value', 'The node id is invalid.', '/id');
  if (typeof input.type !== 'string')
    return failure('invalid-value', 'The node type is missing.', '/type');
  const spec = registry.get(input.type);
  if (spec === undefined) {
    return failure(
      'unknown-type',
      `Node type "${input.type.slice(0, 64)}" is not in the registry.`,
      '/type'
    );
  }
  const label = at(checkText(input.label, limits.maxLabelLength, 'The node label'), '/label');
  if (!label.ok) return label;
  const position = input.position;
  if (
    !isPlainRecord(position) ||
    !checkCoordinate(position.x, limits) ||
    !checkCoordinate(position.y, limits)
  ) {
    return failure(
      'invalid-value',
      'The node position needs finite x and y within limits.',
      '/position'
    );
  }
  const node: WorkflowNode = {
    id: input.id,
    type: input.type,
    label: label.value,
    position: { x: position.x + 0, y: position.y + 0 },
  };
  if (input.props !== undefined) {
    if (!isPlainRecord(input.props))
      return failure('invalid-value', 'Node props must be an object.', '/props');
    const names = Object.keys(input.props);
    if (names.length > limits.maxPropsPerNode) {
      return failure('limit', `A node holds at most ${limits.maxPropsPerNode} props.`, '/props');
    }
    const props: Record<string, WorkflowScalar> = {};
    for (const name of names) {
      const propSpec = isPropName(name) ? spec.props?.[name] : undefined;
      if (propSpec === undefined || !Object.hasOwn(spec.props ?? {}, name)) {
        return failure(
          'invalid-value',
          `Type "${spec.type}" has no prop "${name.slice(0, 64)}".`,
          `/props/${name}`
        );
      }
      const value = at(checkPropValue(propSpec, input.props[name], name, limits), `/props/${name}`);
      if (!value.ok) return value;
      defineEntry(props, name, value.value);
    }
    if (names.length > 0) node.props = props;
  }
  if (input.group !== undefined) {
    if (typeof input.group !== 'string' || !draft.groups.has(input.group)) {
      return failure('unknown-id', 'The node group does not exist.', '/group');
    }
    node.group = input.group;
  }
  if (input.metadata !== undefined) {
    const metadata = at(checkMetadata(input.metadata, limits), '/metadata');
    if (!metadata.ok) return metadata;
    if (Object.keys(metadata.value).length > 0) node.metadata = metadata.value;
  }
  return { ok: true, value: node };
}

function readRef(input: unknown, path: string): Checked<PortRef> {
  if (!isPlainRecord(input) || !isWorkflowId(input.node) || !isWorkflowId(input.port)) {
    return failure('invalid-value', 'A port reference needs a node id and a port id.', path);
  }
  return { ok: true, value: { node: input.node, port: input.port } };
}

function readEdge(input: unknown, limits: WorkflowLimits): Checked<WorkflowEdge> {
  if (!isPlainRecord(input)) return failure('invalid-value', 'An edge must be an object.');
  if (!isWorkflowId(input.id)) return failure('invalid-value', 'The edge id is invalid.', '/id');
  const from = readRef(input.from, '/from');
  if (!from.ok) return from;
  const to = readRef(input.to, '/to');
  if (!to.ok) return to;
  const edge: WorkflowEdge = { id: input.id, from: from.value, to: to.value };
  if (input.label !== undefined) {
    const label = at(checkText(input.label, limits.maxLabelLength, 'The edge label'), '/label');
    if (!label.ok) return label;
    if (label.value !== '') edge.label = label.value;
  }
  return { ok: true, value: edge };
}

function readGroup(input: unknown, limits: WorkflowLimits): Checked<WorkflowGroup> {
  if (!isPlainRecord(input)) return failure('invalid-value', 'A group must be an object.');
  if (!isWorkflowId(input.id)) return failure('invalid-value', 'The group id is invalid.', '/id');
  const label = at(checkText(input.label, limits.maxLabelLength, 'The group label'), '/label');
  if (!label.ok) return label;
  return { ok: true, value: { id: input.id, label: label.value } };
}

// ---------------------------------------------------------------------------
// Primitive mutations shared by the ops and by document parsing.
// ---------------------------------------------------------------------------

export function addNode(draft: GraphDraft, input: unknown): Checked<WorkflowNode> {
  const node = readNode(input, draft);
  if (!node.ok) return node;
  if (draft.hasId(node.value.id))
    return failure('duplicate-id', `Id "${node.value.id}" is already used.`, '/id');
  if (draft.nodes.size >= draft.limits.maxNodes) {
    return failure('limit', `A workflow holds at most ${draft.limits.maxNodes} nodes.`);
  }
  draft.setNode(node.value);
  return node;
}

export function addGroup(draft: GraphDraft, input: unknown): Checked<WorkflowGroup> {
  const group = readGroup(input, draft.limits);
  if (!group.ok) return group;
  if (draft.hasId(group.value.id))
    return failure('duplicate-id', `Id "${group.value.id}" is already used.`, '/id');
  if (draft.groups.size >= draft.limits.maxGroups) {
    return failure('limit', `A workflow holds at most ${draft.limits.maxGroups} groups.`);
  }
  draft.groups.set(group.value.id, group.value);
  draft.groupsChanged = true;
  return group;
}

/**
 * Check that `edge` may join the draft: ends exist, ports exist and face the
 * right way, data types are compatible, cardinality holds, it duplicates no
 * edge and (under `forbid`) closes no cycle. The edge itself must not be in
 * the draft yet.
 */
export function checkEdge(
  draft: GraphDraft,
  edge: WorkflowEdge,
  checkCycle: boolean
): Checked<WorkflowEdge> {
  const { registry } = draft;
  const fromNode = draft.nodes.get(edge.from.node);
  if (fromNode === undefined)
    return failure('unknown-id', `No node "${edge.from.node}".`, '/from/node');
  const toNode = draft.nodes.get(edge.to.node);
  if (toNode === undefined) return failure('unknown-id', `No node "${edge.to.node}".`, '/to/node');
  const fromPort = registry.port(fromNode.type, edge.from.port);
  if (fromPort === undefined) {
    return failure(
      'unknown-port',
      `Type "${fromNode.type}" has no port "${edge.from.port}".`,
      '/from/port'
    );
  }
  const toPort = registry.port(toNode.type, edge.to.port);
  if (toPort === undefined) {
    return failure(
      'unknown-port',
      `Type "${toNode.type}" has no port "${edge.to.port}".`,
      '/to/port'
    );
  }
  if (fromPort.direction !== 'out')
    return failure('port-direction', 'An edge starts at an output port.', '/from/port');
  if (toPort.direction !== 'in')
    return failure('port-direction', 'An edge ends at an input port.', '/to/port');
  if (!registry.compatible(fromPort.dataType, toPort.dataType)) {
    return failure(
      'port-type',
      `A "${fromPort.dataType}" output cannot feed a "${toPort.dataType}" input.`
    );
  }
  let fromCount = 0;
  for (const id of draft.outgoing(edge.from.node)) {
    const other = draft.edges.get(id) as WorkflowEdge;
    if (other.from.port !== edge.from.port) continue;
    if (other.to.node === edge.to.node && other.to.port === edge.to.port) {
      return failure('duplicate-edge', `Edge "${other.id}" already joins these ports.`);
    }
    fromCount++;
  }
  if (fromPort.cardinality === 'one' && fromCount > 0) {
    return failure('cardinality', `Port "${edge.from.port}" takes one edge.`, '/from/port');
  }
  if (toPort.cardinality === 'one') {
    for (const id of draft.incoming(edge.to.node)) {
      if ((draft.edges.get(id) as WorkflowEdge).to.port === edge.to.port) {
        return failure('cardinality', `Port "${edge.to.port}" takes one edge.`, '/to/port');
      }
    }
  }
  if (checkCycle && draft.source.cycles === 'forbid') {
    if (draft.deferCycles) draft.cyclePending = true;
    else if (draft.reaches(edge.to.node, edge.from.node)) {
      return failure('cycle', 'This edge would close a cycle, and this workflow forbids cycles.');
    }
  }
  return { ok: true, value: edge };
}

export function connect(
  draft: GraphDraft,
  input: unknown,
  checkCycle = true
): Checked<WorkflowEdge> {
  const edge = readEdge(input, draft.limits);
  if (!edge.ok) return edge;
  if (draft.hasId(edge.value.id))
    return failure('duplicate-id', `Id "${edge.value.id}" is already used.`, '/id');
  if (draft.edges.size >= draft.limits.maxEdges) {
    return failure('limit', `A workflow holds at most ${draft.limits.maxEdges} edges.`);
  }
  const checked = checkEdge(draft, edge.value, checkCycle);
  if (!checked.ok) return checked;
  draft.addEdge(edge.value);
  return edge;
}

// ---------------------------------------------------------------------------
// The ops.
// ---------------------------------------------------------------------------

function idsOf(input: unknown, max: number, path: string): Checked<string[]> {
  if (!Array.isArray(input) || input.length > max) {
    return failure('invalid-value', `Expected a list of at most ${max} ids.`, path);
  }
  const ids = new Set<string>();
  for (const id of input) {
    if (!isWorkflowId(id) || ids.has(id))
      return failure('invalid-value', 'Ids must be valid and unique.', path);
    ids.add(id);
  }
  return { ok: true, value: [...ids] };
}

function removeNodeOp(draft: GraphDraft, id: unknown): Applied {
  const node = typeof id === 'string' ? draft.nodes.get(id) : undefined;
  if (node === undefined) return fail('unknown-id', `No node "${String(id).slice(0, 64)}".`, '/id');
  const incident = new Set([...draft.outgoing(node.id), ...draft.incoming(node.id)]);
  const edges = [...incident].sort(byId).map((edgeId) => draft.edges.get(edgeId) as WorkflowEdge);
  for (const edge of edges) draft.deleteEdge(edge);
  draft.nodes.delete(node.id);
  draft.nodesChanged = true;
  return {
    ok: true,
    changed: true,
    inverse: [
      { op: 'addNode', node },
      ...edges.map((edge): WorkflowOp => ({ op: 'connect', edge })),
    ],
  };
}

function moveNodesOp(draft: GraphDraft, moves: unknown): Applied {
  if (!Array.isArray(moves) || moves.length > draft.limits.maxNodes) {
    return fail('invalid-value', `Expected at most ${draft.limits.maxNodes} moves.`, '/moves');
  }
  const seen = new Set<string>();
  const inverse: NodeMove[] = [];
  for (let i = 0; i < moves.length; i++) {
    const move: unknown = moves[i];
    const path = `/moves/${i}`;
    if (!isPlainRecord(move) || typeof move.id !== 'string')
      return fail('invalid-value', 'A move needs an id.', path);
    const node = draft.nodes.get(move.id);
    if (node === undefined) return fail('unknown-id', `No node "${move.id.slice(0, 64)}".`, path);
    if (seen.has(node.id)) return fail('invalid-value', `Node "${node.id}" moves twice.`, path);
    seen.add(node.id);
    if (!checkCoordinate(move.x, draft.limits) || !checkCoordinate(move.y, draft.limits)) {
      return fail('invalid-value', 'A move needs finite x and y within limits.', path);
    }
    const x = move.x + 0;
    const y = move.y + 0;
    if (node.position.x === x && node.position.y === y) continue;
    inverse.push({ id: node.id, x: node.position.x, y: node.position.y });
    draft.setNode({ ...node, position: { x, y } });
  }
  return inverse.length === 0
    ? { ok: true, changed: false, inverse: [] }
    : { ok: true, changed: true, inverse: [{ op: 'moveNodes', moves: inverse }] };
}

function disconnectOp(draft: GraphDraft, id: unknown): Applied {
  const edge = typeof id === 'string' ? draft.edges.get(id) : undefined;
  if (edge === undefined) return fail('unknown-id', `No edge "${String(id).slice(0, 64)}".`, '/id');
  draft.deleteEdge(edge);
  return { ok: true, changed: true, inverse: [{ op: 'connect', edge }] };
}

function reconnectOp(draft: GraphDraft, op: Record<string, unknown>): Applied {
  const edge = typeof op.id === 'string' ? draft.edges.get(op.id) : undefined;
  if (edge === undefined)
    return fail('unknown-id', `No edge "${String(op.id).slice(0, 64)}".`, '/id');
  if (op.from === undefined && op.to === undefined) {
    return fail('invalid-value', 'A reconnect moves "from", "to" or both.');
  }
  const from =
    op.from === undefined ? { ok: true as const, value: edge.from } : readRef(op.from, '/from');
  if (!from.ok) return from;
  const to = op.to === undefined ? { ok: true as const, value: edge.to } : readRef(op.to, '/to');
  if (!to.ok) return to;
  const same = (a: PortRef, b: PortRef) => a.node === b.node && a.port === b.port;
  if (same(from.value, edge.from) && same(to.value, edge.to))
    return { ok: true, changed: false, inverse: [] };
  const next: WorkflowEdge = { ...edge, from: from.value, to: to.value };
  draft.unlink(edge);
  const checked = checkEdge(draft, next, true);
  if (!checked.ok) return checked;
  draft.replaceEdge(edge, next);
  return {
    ok: true,
    changed: true,
    inverse: [{ op: 'reconnect', id: edge.id, from: edge.from, to: edge.to }],
  };
}

function setPropsOp(draft: GraphDraft, op: Record<string, unknown>): Applied {
  const id = op.id;
  if (typeof id !== 'string' || !draft.hasId(id)) {
    return fail('unknown-id', `No node, edge or group "${String(id).slice(0, 64)}".`, '/id');
  }
  let label: string | undefined;
  if (op.label !== undefined) {
    const checked = at(checkText(op.label, draft.limits.maxLabelLength, 'The label'), '/label');
    if (!checked.ok) return checked;
    label = checked.value;
  }
  const node = draft.nodes.get(id);
  if (node === undefined) {
    if (op.props !== undefined || op.unset !== undefined) {
      return fail('invalid-op', 'Only nodes carry props.', '/props');
    }
    if (label === undefined) return { ok: true, changed: false, inverse: [] };
    const edge = draft.edges.get(id);
    if (edge !== undefined) {
      const previous = edge.label ?? '';
      if (previous === label) return { ok: true, changed: false, inverse: [] };
      const { label: _old, ...rest } = edge;
      draft.replaceEdge(edge, label === '' ? rest : { ...rest, label });
      return { ok: true, changed: true, inverse: [{ op: 'setProps', id, label: previous }] };
    }
    const group = draft.groups.get(id) as WorkflowGroup;
    if (group.label === label) return { ok: true, changed: false, inverse: [] };
    draft.groups.set(id, { ...group, label });
    draft.groupsChanged = true;
    return { ok: true, changed: true, inverse: [{ op: 'setProps', id, label: group.label }] };
  }

  const spec = draft.registry.get(node.type);
  const props: Record<string, WorkflowScalar> = {};
  for (const [name, value] of Object.entries(node.props ?? {})) defineEntry(props, name, value);
  const restoreProps: Record<string, WorkflowScalar> = {};
  const restoreUnset: string[] = [];
  const touched = new Set<string>();
  const remember = (name: string) => {
    if (touched.has(name)) return;
    touched.add(name);
    if (Object.hasOwn(props, name)) defineEntry(restoreProps, name, props[name] as WorkflowScalar);
    else restoreUnset.push(name);
  };
  if (op.props !== undefined) {
    if (!isPlainRecord(op.props))
      return fail('invalid-value', 'Props must be an object.', '/props');
    for (const name of Object.keys(op.props)) {
      const propSpec =
        isPropName(name) && spec?.props && Object.hasOwn(spec.props, name)
          ? spec.props[name]
          : undefined;
      if (propSpec === undefined) {
        return fail(
          'invalid-value',
          `Type "${node.type}" has no prop "${name.slice(0, 64)}".`,
          `/props/${name}`
        );
      }
      const value = at(
        checkPropValue(propSpec, op.props[name], name, draft.limits),
        `/props/${name}`
      );
      if (!value.ok) return value;
      if (props[name] === value.value && Object.hasOwn(props, name)) continue;
      remember(name);
      defineEntry(props, name, value.value);
    }
  }
  if (op.unset !== undefined) {
    if (!Array.isArray(op.unset) || op.unset.length > draft.limits.maxPropsPerNode) {
      return fail('invalid-value', 'Unset must be a short list of prop names.', '/unset');
    }
    for (const name of op.unset) {
      if (!isPropName(name))
        return fail('invalid-value', 'Unset holds an invalid prop name.', '/unset');
      if (isPlainRecord(op.props) && Object.hasOwn(op.props, name)) {
        return fail('invalid-value', `Prop "${name}" is both set and unset.`, '/unset');
      }
      if (!Object.hasOwn(props, name)) continue;
      remember(name);
      delete props[name];
    }
  }
  if (Object.keys(props).length > draft.limits.maxPropsPerNode) {
    return fail('limit', `A node holds at most ${draft.limits.maxPropsPerNode} props.`, '/props');
  }
  const labelChanged = label !== undefined && label !== node.label;
  if (!labelChanged && touched.size === 0) return { ok: true, changed: false, inverse: [] };
  const { props: _props, ...rest } = node;
  const next: WorkflowNode = { ...rest, ...(labelChanged ? { label: label as string } : {}) };
  if (Object.keys(props).length > 0) next.props = props;
  draft.setNode(next);
  const inverse: WorkflowOp = { op: 'setProps', id };
  if (labelChanged) inverse.label = node.label;
  if (Object.keys(restoreProps).length > 0) inverse.props = restoreProps;
  if (restoreUnset.length > 0) inverse.unset = restoreUnset;
  return { ok: true, changed: true, inverse: [inverse] };
}

function groupOp(draft: GraphDraft, op: Record<string, unknown>): Applied {
  const members = idsOf(op.nodes, draft.limits.maxNodes, '/nodes');
  if (!members.ok) return members;
  for (const id of members.value) {
    const node = draft.nodes.get(id);
    if (node === undefined) return fail('unknown-id', `No node "${id}".`, '/nodes');
    if (node.group !== undefined)
      return fail('already-grouped', `Node "${id}" is already in a group.`, '/nodes');
  }
  const group = at(addGroup(draft, op.group), '/group');
  if (!group.ok) return group;
  for (const id of members.value) {
    draft.setNode({ ...(draft.nodes.get(id) as WorkflowNode), group: group.value.id });
  }
  return { ok: true, changed: true, inverse: [{ op: 'ungroup', id: group.value.id }] };
}

function ungroupOp(draft: GraphDraft, id: unknown): Applied {
  const group = typeof id === 'string' ? draft.groups.get(id) : undefined;
  if (group === undefined)
    return fail('unknown-id', `No group "${String(id).slice(0, 64)}".`, '/id');
  const members: string[] = [];
  for (const node of draft.nodes.values()) {
    if (node.group !== group.id) continue;
    members.push(node.id);
    const { group: _group, ...rest } = node;
    draft.setNode(rest);
  }
  draft.groups.delete(group.id);
  draft.groupsChanged = true;
  return { ok: true, changed: true, inverse: [{ op: 'group', group, nodes: members.sort(byId) }] };
}

function pasteOp(draft: GraphDraft, fragment: unknown): Applied {
  if (!isPlainRecord(fragment))
    return fail('invalid-value', 'A paste needs a fragment.', '/fragment');
  const { nodes, edges, groups } = fragment;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(groups)) {
    return fail('invalid-value', 'A fragment holds nodes, edges and groups lists.', '/fragment');
  }
  const { limits } = draft;
  if (
    nodes.length > limits.maxNodes - draft.nodes.size ||
    edges.length > limits.maxEdges - draft.edges.size ||
    groups.length > limits.maxGroups - draft.groups.size
  ) {
    return fail('limit', 'The fragment does not fit within the workflow limits.', '/fragment');
  }
  const groupIds: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = at(addGroup(draft, groups[i]), `/fragment/groups/${i}`);
    if (!group.ok) return group;
    groupIds.push(group.value.id);
  }
  const nodeIds = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const node = at(addNode(draft, nodes[i]), `/fragment/nodes/${i}`);
    if (!node.ok) return node;
    nodeIds.add(node.value.id);
  }
  for (let i = 0; i < edges.length; i++) {
    const path = `/fragment/edges/${i}`;
    const edge: unknown = edges[i];
    const end = (key: 'from' | 'to') => {
      const ref = isPlainRecord(edge) ? edge[key] : undefined;
      return isPlainRecord(ref) ? ref.node : undefined;
    };
    if (!nodeIds.has(end('from') as string) || !nodeIds.has(end('to') as string)) {
      return fail('invalid-value', 'A fragment edge must join two nodes of the fragment.', path);
    }
    const added = at(connect(draft, edge), path);
    if (!added.ok) return added;
  }
  const changed = nodeIds.size > 0 || groupIds.length > 0;
  return {
    ok: true,
    changed,
    inverse: [
      ...[...nodeIds].map((id): WorkflowOp => ({ op: 'removeNode', id })),
      ...groupIds.map((id): WorkflowOp => ({ op: 'ungroup', id })),
    ],
  };
}

function applyOne(draft: GraphDraft, op: unknown): Applied {
  if (!isPlainRecord(op)) return fail('invalid-op', 'An op must be an object.');
  const added = (result: Checked<unknown>, path: string, inverse: () => WorkflowOp): Applied => {
    const scoped = at(result, path);
    return scoped.ok ? { ok: true, changed: true, inverse: [inverse()] } : scoped;
  };
  switch (op.op) {
    case 'addNode': {
      const node = addNode(draft, op.node);
      return added(node, '/node', () => ({
        op: 'removeNode',
        id: (node as { value: WorkflowNode }).value.id,
      }));
    }
    case 'removeNode':
      return removeNodeOp(draft, op.id);
    case 'moveNodes':
      return moveNodesOp(draft, op.moves);
    case 'connect': {
      const edge = connect(draft, op.edge);
      return added(edge, '/edge', () => ({
        op: 'disconnect',
        id: (edge as { value: WorkflowEdge }).value.id,
      }));
    }
    case 'disconnect':
      return disconnectOp(draft, op.id);
    case 'reconnect':
      return reconnectOp(draft, op);
    case 'setProps':
      return setPropsOp(draft, op);
    case 'group':
      return groupOp(draft, op);
    case 'ungroup':
      return ungroupOp(draft, op.id);
    case 'paste':
      return pasteOp(draft, op.fragment);
    default:
      return fail('invalid-op', `Unknown op "${String(op.op).slice(0, 32)}".`, '/op');
  }
}

/**
 * Apply ops to a graph, all or none. The input graph is never mutated; a
 * refused op reports its index and the graph stays as it was. On success
 * the result carries the inverse ops that restore the previous graph.
 * Mirrors the catalog's `applyEditOps`.
 */
export function applyWorkflowOps(
  graph: WorkflowGraph,
  ops: readonly WorkflowOp[],
  context: WorkflowContext
): WorkflowResult {
  const limits = resolveLimits(context.limits);
  if (!Array.isArray(ops))
    return { ok: false, error: { code: 'invalid-op', message: 'Ops must be a list.' } };
  if (ops.length > limits.maxOps) {
    return {
      ok: false,
      error: { code: 'limit', message: `A batch holds at most ${limits.maxOps} ops.` },
    };
  }
  // A batch of edges checks cycles once at the end (one O(V + E) pass)
  // instead of walking the graph per edge. Only when that pass finds a
  // cycle is the batch replayed edge by edge, to name the op that closed it.
  return run(graph, ops, context, limits, ops.length > 1);
}

function run(
  graph: WorkflowGraph,
  ops: readonly WorkflowOp[],
  context: WorkflowContext,
  limits: WorkflowLimits,
  deferCycles: boolean
): WorkflowResult {
  const draft = new GraphDraft(graph, context.registry, limits);
  draft.deferCycles = deferCycles;
  const inverses: WorkflowOp[][] = [];
  let changed = false;
  for (let i = 0; i < ops.length; i++) {
    const result = applyOne(draft, ops[i]);
    if (!result.ok) return { ok: false, error: { ...result.error, opIndex: i } };
    inverses.push(result.inverse);
    changed ||= result.changed;
  }
  if (draft.cyclePending && findCycleEdge(draft.nodes.keys(), draft.edges.values()) !== undefined) {
    return run(graph, ops, context, limits, false);
  }
  if (!changed) return { ok: true, graph, inverse: [], changed: false };
  return { ok: true, graph: draft.toGraph(), inverse: inverses.reverse().flat(), changed: true };
}

/** Apply one op. See {@link applyWorkflowOps}. */
export function applyWorkflowOp(
  graph: WorkflowGraph,
  op: WorkflowOp,
  context: WorkflowContext
): WorkflowResult {
  return applyWorkflowOps(graph, [op], context);
}
