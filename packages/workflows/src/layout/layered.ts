import type { NodeMove, Point, WorkflowEdge, WorkflowNode } from '../model/types.ts';

export type LayoutDirection = 'LR' | 'TB';

export interface Size {
  width: number;
  height: number;
}

export interface LayoutOptions {
  /** `LR` lays ranks left to right, `TB` top to bottom. Default `LR`. */
  direction?: LayoutDirection;
  /**
   * Mirror the layout horizontally for right-to-left reading: `LR` ranks
   * then flow right to left, and `TB` rows read from the right.
   */
  rtl?: boolean;
  /** Measured or estimated node sizes. Default {@link DEFAULT_NODE_SIZE}. */
  nodeSize?: (node: WorkflowNode) => Size;
  /** Space between ranks. Default 80. */
  rankGap?: number;
  /** Space between neighbors in one rank. Default 32. */
  nodeGap?: number;
  /** Crossing-reduction sweeps (each one down and one up). Default 8, at most 24. */
  sweeps?: number;
  /** Top-left corner of the layout. Default `{ x: 0, y: 0 }`. */
  origin?: Point;
}

export interface WorkflowLayout {
  /** Top-left corner of every node. */
  positions: ReadonlyMap<string, Point>;
  ranks: ReadonlyMap<string, number>;
  /** Node ids per rank, in cross-axis order. */
  layers: readonly (readonly string[])[];
  /** Edges laid out against their direction to break cycles. */
  reversed: readonly string[];
  /** Crossings between adjacent ranks after reduction. */
  crossings: number;
  size: Size;
}

export const DEFAULT_NODE_SIZE: Readonly<Size> = Object.freeze({ width: 180, height: 64 });

const MAX_SWEEPS = 24;

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Deterministic layered (Sugiyama-style) layout for a workflow graph:
 *
 * 1. **Cycles** are broken by a depth-first search in id order; back edges
 *    are laid out reversed (and listed in `reversed`). Self-loops are ignored.
 * 2. **Ranks** come from the longest path, then every node with successors is
 *    pulled down next to its nearest successor, which shortens edges out of
 *    sources.
 * 3. **Order** within ranks: barycenter sweeps down and up, ties kept in the
 *    previous order, and the order with the fewest adjacent-rank crossings
 *    wins. Long edges count their endpoints' positions directly; no dummy
 *    nodes are added, so the work stays O(sweeps × edges) at any rank span.
 * 4. **Coordinates**: ranks are bands as deep as their largest node; inside
 *    a rank each node moves toward the mean of its neighbors, then neighbors
 *    are pushed apart to the node gap.
 *
 * Equal input gives equal output, whatever order nodes and edges arrive in:
 * everything is keyed and tie-broken by id. Positions are whole numbers.
 */
export function layoutWorkflow(
  graph: { nodes: readonly WorkflowNode[]; edges: readonly WorkflowEdge[] },
  options: LayoutOptions = {}
): WorkflowLayout {
  const direction: LayoutDirection = options.direction === 'TB' ? 'TB' : 'LR';
  const rankGap = finite(options.rankGap, 80);
  const nodeGap = finite(options.nodeGap, 32);
  const sweeps = Math.min(MAX_SWEEPS, Math.floor(finite(options.sweeps, 8)));
  const originX = options.origin?.x ?? 0;
  const originY = options.origin?.y ?? 0;

  const nodes = [...graph.nodes].sort((a, b) => compare(a.id, b.id));
  const count = nodes.length;
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const sizes = nodes.map((node) => {
    const size = options.nodeSize?.(node) ?? DEFAULT_NODE_SIZE;
    return {
      width: finite(size.width, DEFAULT_NODE_SIZE.width),
      height: finite(size.height, DEFAULT_NODE_SIZE.height),
    };
  });
  const edges = graph.edges
    .filter(
      (edge) =>
        edge.from.node !== edge.to.node && index.has(edge.from.node) && index.has(edge.to.node)
    )
    .sort((a, b) => compare(a.id, b.id));

  // 1. Break cycles: iterative DFS in id order; back edges are reversed.
  const out: { edge: number; to: number }[][] = nodes.map(() => []);
  edges.forEach((edge, e) => {
    out[index.get(edge.from.node) as number]?.push({
      edge: e,
      to: index.get(edge.to.node) as number,
    });
  });
  const state = new Uint8Array(count); // 0 new, 1 on the stack, 2 done
  const reversedEdge = new Uint8Array(edges.length);
  const postorder: number[] = [];
  for (let root = 0; root < count; root++) {
    if (state[root] !== 0) continue;
    const stack: [number, number][] = [[root, 0]];
    state[root] = 1;
    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as [number, number];
      const [node, next] = frame;
      const list = out[node] as { edge: number; to: number }[];
      if (next < list.length) {
        frame[1] = next + 1;
        const { edge, to } = list[next] as { edge: number; to: number };
        if (state[to] === 1) reversedEdge[edge] = 1;
        else if (state[to] === 0) {
          state[to] = 1;
          stack.push([to, 0]);
        }
      } else {
        state[node] = 2;
        postorder.push(node);
        stack.pop();
      }
    }
  }
  const preds: number[][] = nodes.map(() => []);
  const succs: number[][] = nodes.map(() => []);
  const reversed: string[] = [];
  edges.forEach((edge, e) => {
    let u = index.get(edge.from.node) as number;
    let v = index.get(edge.to.node) as number;
    if (reversedEdge[e] === 1) {
      [u, v] = [v, u];
      reversed.push(edge.id);
    }
    (succs[u] as number[]).push(v);
    (preds[v] as number[]).push(u);
  });

  // 2. Ranks: longest path in topological (reverse postorder) order, then pull down.
  const topo = postorder.reverse();
  const rank = new Int32Array(count);
  for (const v of topo)
    for (const u of preds[v] as number[])
      rank[v] = Math.max(rank[v] as number, (rank[u] as number) + 1);
  for (let i = topo.length - 1; i >= 0; i--) {
    const v = topo[i] as number;
    const next = succs[v] as number[];
    if (next.length === 0) continue;
    let nearest = Number.POSITIVE_INFINITY;
    for (const w of next) nearest = Math.min(nearest, rank[w] as number);
    rank[v] = Math.max(rank[v] as number, nearest - 1);
  }
  let rankCount = 0;
  for (let v = 0; v < count; v++) rankCount = Math.max(rankCount, (rank[v] as number) + 1);

  // 3. Order: initial order follows the topological order.
  let layers: number[][] = Array.from({ length: rankCount }, () => []);
  for (const v of topo) (layers[rank[v] as number] as number[]).push(v);
  const position = new Float64Array(count);
  const place = (layer: readonly number[]) => {
    layer.forEach((v, i) => {
      position[v] = (i + 0.5) / layer.length;
    });
  };
  for (const layer of layers) place(layer);
  const reorder = (layer: number[], neighbors: number[][]) => {
    const keyed = layer.map((v, i) => {
      const list = neighbors[v] as number[];
      let sum = 0;
      for (const w of list) sum += position[w] as number;
      return { v, i, key: list.length > 0 ? sum / list.length : (position[v] as number) };
    });
    keyed.sort((a, b) => a.key - b.key || a.i - b.i);
    const ordered = keyed.map((entry) => entry.v);
    place(ordered);
    return ordered;
  };
  let best = layers.map((layer) => [...layer]);
  let bestCrossings = countCrossings(layers, rank, succs, count);
  for (let sweep = 0; sweep < sweeps && bestCrossings > 0; sweep++) {
    for (let r = 1; r < rankCount; r++) layers[r] = reorder(layers[r] as number[], preds);
    for (let r = rankCount - 2; r >= 0; r--) layers[r] = reorder(layers[r] as number[], succs);
    const crossings = countCrossings(layers, rank, succs, count);
    if (crossings < bestCrossings) {
      bestCrossings = crossings;
      best = layers.map((layer) => [...layer]);
    }
  }
  layers = best;

  // 4. Coordinates. "Depth" runs along the ranks, "breadth" across them.
  const depthOf = (v: number) =>
    (direction === 'LR' ? sizes[v]?.width : sizes[v]?.height) as number;
  const breadthOf = (v: number) =>
    (direction === 'LR' ? sizes[v]?.height : sizes[v]?.width) as number;
  const bandStart: number[] = [];
  const bandDepth: number[] = [];
  let depthTotal = 0;
  layers.forEach((layer, r) => {
    let deepest = 0;
    for (const v of layer) deepest = Math.max(deepest, depthOf(v));
    bandStart[r] = depthTotal;
    bandDepth[r] = deepest;
    depthTotal += deepest + (r < layers.length - 1 ? rankGap : 0);
  });
  const center = new Float64Array(count);
  for (const layer of layers) {
    let cursor = 0;
    for (const v of layer) {
      center[v] = cursor + breadthOf(v) / 2;
      cursor += breadthOf(v) + nodeGap;
    }
  }
  const align = (layer: readonly number[], neighbors: number[][]) => {
    const n = layer.length;
    if (n === 0) return;
    const desired = layer.map((v) => {
      const list = neighbors[v] as number[];
      if (list.length === 0) return center[v] as number;
      let sum = 0;
      for (const w of list) sum += center[w] as number;
      return sum / list.length;
    });
    const gap = (i: number) =>
      (breadthOf(layer[i - 1] as number) + breadthOf(layer[i] as number)) / 2 + nodeGap;
    const forward = [...desired];
    for (let i = 1; i < n; i++)
      forward[i] = Math.max(desired[i] as number, (forward[i - 1] as number) + gap(i));
    const backward = [...desired];
    for (let i = n - 2; i >= 0; i--)
      backward[i] = Math.min(desired[i] as number, (backward[i + 1] as number) - gap(i + 1));
    let previous = Number.NEGATIVE_INFINITY;
    layer.forEach((v, i) => {
      const value = ((forward[i] as number) + (backward[i] as number)) / 2;
      center[v] = i === 0 ? value : Math.max(value, previous + gap(i));
      previous = center[v] as number;
    });
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let r = 1; r < layers.length; r++) align(layers[r] as number[], preds);
    for (let r = layers.length - 2; r >= 0; r--) align(layers[r] as number[], succs);
  }
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (let v = 0; v < count; v++) {
    low = Math.min(low, (center[v] as number) - breadthOf(v) / 2);
    high = Math.max(high, (center[v] as number) + breadthOf(v) / 2);
  }
  const breadthTotal = count === 0 ? 0 : high - low;
  const width = Math.round(direction === 'LR' ? depthTotal : breadthTotal);
  const height = Math.round(direction === 'LR' ? breadthTotal : depthTotal);

  const positions = new Map<string, Point>();
  const ranks = new Map<string, number>();
  for (let v = 0; v < count; v++) {
    const r = rank[v] as number;
    const size = sizes[v] as Size;
    const depth = (bandStart[r] as number) + ((bandDepth[r] as number) - depthOf(v)) / 2;
    const breadth = (center[v] as number) - breadthOf(v) / 2 - low;
    let x = direction === 'LR' ? depth : breadth;
    const y = direction === 'LR' ? breadth : depth;
    if (options.rtl) x = width - x - size.width;
    const id = (nodes[v] as WorkflowNode).id;
    positions.set(id, { x: Math.round(x + originX) + 0, y: Math.round(y + originY) + 0 });
    ranks.set(id, r);
  }
  return {
    positions,
    ranks,
    layers: layers.map((layer) => layer.map((v) => (nodes[v] as WorkflowNode).id)),
    reversed: reversed.sort(compare),
    crossings: bestCrossings,
    size: { width, height },
  };
}

/**
 * Crossings between adjacent ranks: for each pair of ranks, sort the
 * single-span edges by their upper end and count inversions of their lower
 * ends with a Fenwick tree. O(E log E).
 */
function countCrossings(
  layers: number[][],
  rank: Int32Array,
  succs: number[][],
  count: number
): number {
  const order = new Int32Array(count);
  for (const layer of layers) {
    for (const [i, v] of layer.entries()) order[v] = i;
  }
  let total = 0;
  for (let r = 0; r < layers.length - 1; r++) {
    const pairs: [number, number][] = [];
    for (const u of layers[r] as number[]) {
      for (const v of succs[u] as number[]) {
        if (rank[v] === r + 1) pairs.push([order[u] as number, order[v] as number]);
      }
    }
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const size = (layers[r + 1] as number[]).length;
    const tree = new Int32Array(size + 1);
    let seen = 0;
    for (const [, lower] of pairs) {
      let atMost = 0;
      for (let i = lower + 1; i > 0; i -= i & -i) atMost += tree[i] as number;
      total += seen - atMost;
      for (let i = lower + 1; i <= size; i += i & -i) tree[i] = (tree[i] as number) + 1;
      seen++;
    }
  }
  return total;
}

/** The layout as a `moveNodes` payload, sorted by id, for one undoable step. */
export function layoutMoves(layout: WorkflowLayout): NodeMove[] {
  return [...layout.positions]
    .sort(([a], [b]) => compare(a, b))
    .map(([id, point]) => ({ id, x: point.x, y: point.y }));
}
