import type { NodeTypeRegistry } from './registry.ts';
import type {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowGroup,
  WorkflowLimits,
  WorkflowNode,
} from './types.ts';

/**
 * A mutable working copy of a graph for one batch of ops. It is built once
 * per batch (O(nodes + edges)), mutated op by op, and either turned back into
 * a new graph or thrown away when an op fails, so a batch is all or none and
 * the input graph is never mutated. Untouched arrays are shared with the
 * source graph. Adjacency is only built when an op needs it.
 */
export class GraphDraft {
  readonly source: WorkflowGraph;
  readonly registry: NodeTypeRegistry;
  readonly limits: WorkflowLimits;
  readonly nodes: Map<string, WorkflowNode>;
  readonly edges: Map<string, WorkflowEdge>;
  readonly groups: Map<string, WorkflowGroup>;
  nodesChanged = false;
  edgesChanged = false;
  groupsChanged = false;
  /**
   * When set, edge checks skip the per-edge cycle walk and only flag
   * `cyclePending`; the batch runs one whole-graph pass at the end instead.
   */
  deferCycles = false;
  cyclePending = false;
  #out: Map<string, Set<string>> | undefined;
  #in: Map<string, Set<string>> | undefined;

  constructor(source: WorkflowGraph, registry: NodeTypeRegistry, limits: WorkflowLimits) {
    this.source = source;
    this.registry = registry;
    this.limits = limits;
    this.nodes = new Map(source.nodes.map((node) => [node.id, node]));
    this.edges = new Map(source.edges.map((edge) => [edge.id, edge]));
    this.groups = new Map(source.groups.map((group) => [group.id, group]));
  }

  /** Nodes, edges and groups share one id namespace. */
  hasId(id: string): boolean {
    return this.nodes.has(id) || this.edges.has(id) || this.groups.has(id);
  }

  #index(): { out: Map<string, Set<string>>; in: Map<string, Set<string>> } {
    if (this.#out === undefined || this.#in === undefined) {
      this.#out = new Map();
      this.#in = new Map();
      for (const edge of this.edges.values()) this.#link(edge);
    }
    return { out: this.#out, in: this.#in };
  }

  #link(edge: WorkflowEdge): void {
    const out = this.#out as Map<string, Set<string>>;
    const into = this.#in as Map<string, Set<string>>;
    const from = out.get(edge.from.node);
    if (from === undefined) out.set(edge.from.node, new Set([edge.id]));
    else from.add(edge.id);
    const to = into.get(edge.to.node);
    if (to === undefined) into.set(edge.to.node, new Set([edge.id]));
    else to.add(edge.id);
  }

  /** Ids of the edges leaving `node`. */
  outgoing(node: string): ReadonlySet<string> {
    return this.#index().out.get(node) ?? EMPTY;
  }

  /** Ids of the edges entering `node`. */
  incoming(node: string): ReadonlySet<string> {
    return this.#index().in.get(node) ?? EMPTY;
  }

  addEdge(edge: WorkflowEdge): void {
    this.edges.set(edge.id, edge);
    this.edgesChanged = true;
    if (this.#out !== undefined) this.#link(edge);
  }

  deleteEdge(edge: WorkflowEdge): void {
    this.edges.delete(edge.id);
    this.edgesChanged = true;
    this.#out?.get(edge.from.node)?.delete(edge.id);
    this.#in?.get(edge.to.node)?.delete(edge.id);
  }

  /** Drop an edge from the adjacency index only (it stays in `edges`), so checks ignore it. */
  unlink(edge: WorkflowEdge): void {
    const index = this.#index();
    index.out.get(edge.from.node)?.delete(edge.id);
    index.in.get(edge.to.node)?.delete(edge.id);
  }

  /** Swap an edge for a new version with the same id, keeping its place in the order. */
  replaceEdge(previous: WorkflowEdge, next: WorkflowEdge): void {
    this.unlink(previous);
    this.edges.set(next.id, next);
    this.edgesChanged = true;
    if (this.#out !== undefined) this.#link(next);
  }

  setNode(node: WorkflowNode): void {
    this.nodes.set(node.id, node);
    this.nodesChanged = true;
  }

  /** Is `goal` reachable from `start` along edge directions? */
  reaches(start: string, goal: string): boolean {
    if (start === goal) return true;
    const seen = new Set<string>([start]);
    const stack = [start];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const id of this.outgoing(current)) {
        const next = (this.edges.get(id) as WorkflowEdge).to.node;
        if (next === goal) return true;
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return false;
  }

  toGraph(): WorkflowGraph {
    const source = this.source;
    return {
      ...source,
      nodes: this.nodesChanged ? [...this.nodes.values()] : source.nodes,
      edges: this.edgesChanged ? [...this.edges.values()] : source.edges,
      groups: this.groupsChanged ? [...this.groups.values()] : source.groups,
    };
  }
}

const EMPTY: ReadonlySet<string> = new Set();
