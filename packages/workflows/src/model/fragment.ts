import type { NodeTypeRegistry } from './registry.ts';
import type {
  Point,
  WorkflowEdge,
  WorkflowFragment,
  WorkflowGraph,
  WorkflowGroup,
  WorkflowNode,
  WorkflowScalar,
} from './types.ts';

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Copy the nodes `ids` with the edges between them and the groups they sit
 * in. The result is plain JSON, ready for a clipboard.
 */
export function copyFragment(graph: WorkflowGraph, ids: Iterable<string>): WorkflowFragment {
  const wanted = new Set(ids);
  const nodes = graph.nodes.filter((node) => wanted.has(node.id)).sort(byId);
  const kept = new Set(nodes.map((node) => node.id));
  const groupIds = new Set(nodes.flatMap((node) => (node.group === undefined ? [] : [node.group])));
  return {
    nodes,
    edges: graph.edges
      .filter((edge) => kept.has(edge.from.node) && kept.has(edge.to.node))
      .sort(byId),
    groups: graph.groups.filter((group) => groupIds.has(group.id)).sort(byId),
  };
}

/** A fresh id from `base`: `base-2`, `base-3`… trimmed to the 64-character id limit. */
function freshId(base: string, taken: Set<string>): string {
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const id = base.slice(0, 64 - suffix.length) + suffix;
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
}

/**
 * Give every node, edge and group of a fragment an id unused in `graph`,
 * rewire edges and group membership to the new ids, and shift positions by
 * `offset`. Deterministic: ids are assigned in sorted order. The result is
 * what a `paste` op takes.
 */
export function prepareFragment(
  graph: WorkflowGraph,
  fragment: WorkflowFragment,
  options: { offset?: Point } = {}
): WorkflowFragment {
  const dx = options.offset?.x ?? 0;
  const dy = options.offset?.y ?? 0;
  const taken = new Set<string>();
  for (const list of [graph.nodes, graph.edges, graph.groups])
    for (const item of list) taken.add(item.id);
  const rename = new Map<string, string>();
  const assign = (id: string) => {
    const next = taken.has(id) ? freshId(id, taken) : id;
    taken.add(next);
    rename.set(id, next);
  };
  for (const group of [...fragment.groups].sort(byId)) assign(group.id);
  for (const node of [...fragment.nodes].sort(byId)) assign(node.id);
  for (const edge of [...fragment.edges].sort(byId)) assign(edge.id);
  const mapped = (id: string) => rename.get(id) ?? id;
  return {
    groups: fragment.groups.map((group): WorkflowGroup => ({ ...group, id: mapped(group.id) })),
    nodes: fragment.nodes.map((node): WorkflowNode => {
      const next: WorkflowNode = {
        ...node,
        id: mapped(node.id),
        position: { x: node.position.x + dx, y: node.position.y + dy },
      };
      if (node.group !== undefined) next.group = mapped(node.group);
      return next;
    }),
    edges: fragment.edges.map(
      (edge): WorkflowEdge => ({
        ...edge,
        id: mapped(edge.id),
        from: { ...edge.from, node: mapped(edge.from.node) },
        to: { ...edge.to, node: mapped(edge.to.node) },
      })
    ),
  };
}

/**
 * A node of `type` with its declared prop defaults, ready for an `addNode`
 * op. Throws for a type the registry does not know (a developer error).
 */
export function createNode(
  registry: NodeTypeRegistry,
  type: string,
  init: { id: string; position: Point; label?: string; props?: Record<string, WorkflowScalar> }
): WorkflowNode {
  const spec = registry.get(type);
  if (spec === undefined) throw new TypeError(`createNode: type "${type}" is not in the registry.`);
  const props: Record<string, WorkflowScalar> = {};
  for (const [name, prop] of Object.entries(spec.props ?? {})) {
    if ('default' in prop && prop.default !== undefined) {
      Object.defineProperty(props, name, {
        value: prop.default,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  for (const [name, value] of Object.entries(init.props ?? {})) {
    Object.defineProperty(props, name, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  const node: WorkflowNode = {
    id: init.id,
    type,
    label: init.label ?? spec.label,
    position: { x: init.position.x, y: init.position.y },
  };
  if (Object.keys(props).length > 0) node.props = props;
  return node;
}
