import type { NodeTypeRegistry } from '../model/registry.ts';
import type { PortDirection, WorkflowGraph } from '../model/types.ts';
import { type PortPlacement, portKey } from './geometry.ts';

export interface PortTarget {
  node: string;
  port: string;
}

export interface PortEnd extends PortTarget {
  direction: PortDirection;
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function walk(start: string, next: ReadonlyMap<string, string[]>): Set<string> {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length > 0) {
    for (const node of next.get(stack.pop() as string) ?? []) {
      if (!seen.has(node)) {
        seen.add(node);
        stack.push(node);
      }
    }
  }
  return seen;
}

/**
 * The ports `source` may connect to, nearest first (ties by node, then port
 * id), so keyboard connect mode cycles them in a stable order. Mirrors the
 * model's connect checks (direction, data type, cardinality, duplicates and
 * the cycle policy) in one O(nodes + edges) pass; the model still has the
 * last word when the edge is applied.
 */
export function connectCandidates(
  graph: WorkflowGraph,
  registry: NodeTypeRegistry,
  source: PortEnd,
  ports?: ReadonlyMap<string, PortPlacement>
): PortTarget[] {
  const sourceNode = graph.nodes.find((node) => node.id === source.node);
  const sourceSpec = sourceNode && registry.port(sourceNode.type, source.port);
  if (!sourceNode || !sourceSpec) return [];
  const counts = new Map<string, number>();
  const pairs = new Set<string>();
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const fromKey = `out\u0000${portKey(edge.from.node, edge.from.port)}`;
    const toKey = `in\u0000${portKey(edge.to.node, edge.to.port)}`;
    counts.set(fromKey, (counts.get(fromKey) ?? 0) + 1);
    counts.set(toKey, (counts.get(toKey) ?? 0) + 1);
    pairs.add(
      `${portKey(edge.from.node, edge.from.port)}\u0001${portKey(edge.to.node, edge.to.port)}`
    );
    push(forward, edge.from.node, edge.to.node);
    push(backward, edge.to.node, edge.from.node);
  }
  const full = (node: string, port: string, direction: PortDirection, cardinality?: string) =>
    cardinality === 'one' && (counts.get(`${direction}\u0000${portKey(node, port)}`) ?? 0) > 0;
  if (full(source.node, source.port, source.direction, sourceSpec.cardinality)) return [];
  const outgoing = source.direction === 'out';
  // Under `forbid`, a node on the far side of the source would close a loop.
  const blocked =
    graph.cycles === 'forbid'
      ? walk(source.node, outgoing ? backward : forward)
      : new Set<string>();
  const want: PortDirection = outgoing ? 'in' : 'out';
  const found: PortTarget[] = [];
  for (const node of graph.nodes) {
    if (blocked.has(node.id)) continue;
    for (const port of registry.get(node.type)?.ports ?? []) {
      if (port.direction !== want) continue;
      const [fromType, toType] = outgoing
        ? [sourceSpec.dataType, port.dataType]
        : [port.dataType, sourceSpec.dataType];
      if (!registry.compatible(fromType, toType)) continue;
      if (full(node.id, port.id, want, port.cardinality)) continue;
      const pair = outgoing
        ? `${portKey(source.node, source.port)}\u0001${portKey(node.id, port.id)}`
        : `${portKey(node.id, port.id)}\u0001${portKey(source.node, source.port)}`;
      if (pairs.has(pair)) continue;
      found.push({ node: node.id, port: port.id });
    }
  }
  const origin = ports?.get(portKey(source.node, source.port))?.point;
  const far = (target: PortTarget) => {
    const point = ports?.get(portKey(target.node, target.port))?.point;
    return origin && point ? Math.hypot(point.x - origin.x, point.y - origin.y) : 0;
  };
  const key = (target: PortTarget) => portKey(target.node, target.port);
  return found
    .map((target) => ({ target, d: far(target) }))
    .sort(
      (a, b) =>
        a.d - b.d || (key(a.target) < key(b.target) ? -1 : key(a.target) > key(b.target) ? 1 : 0)
    )
    .map(({ target }) => target);
}
