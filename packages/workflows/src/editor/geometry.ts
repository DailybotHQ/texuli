/**
 * Canvas geometry shared by the editor and the viewer: node boxes, port
 * points, edge curves, spatial focus and bounds. Plain numbers; no DOM.
 */
import type { NodeTypeRegistry } from '../model/registry.ts';
import type {
  Point,
  PortDirection,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from '../model/types.ts';

export type FlowDirection = 'LR' | 'TB';
export type TextDirection = 'ltr' | 'rtl';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NodeSize {
  width: number;
  height: number;
}

export const DEFAULT_WORKFLOW_NODE_SIZE: Readonly<NodeSize> = Object.freeze({
  width: 200,
  height: 72,
});

/** A node's size: `metadata.width/height` when set, else the host's function, else the default. */
export function sizeOf(node: WorkflowNode, nodeSize?: (node: WorkflowNode) => NodeSize): NodeSize {
  const width = node.metadata?.width;
  const height = node.metadata?.height;
  if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0)
    return { width, height };
  return nodeSize?.(node) ?? DEFAULT_WORKFLOW_NODE_SIZE;
}

export interface PortPlacement {
  node: string;
  port: string;
  direction: PortDirection;
  dataType: string;
  /** World point at the node edge. */
  point: Point;
  /** Which side of the node the port sits on (physical). */
  side: 'left' | 'right' | 'top' | 'bottom';
}

/**
 * Where a node's ports sit: inputs on the leading side, outputs on the
 * trailing side (left and right swap in right-to-left), spread evenly.
 */
export function portPlacements(
  node: WorkflowNode,
  box: Box,
  registry: NodeTypeRegistry,
  flow: FlowDirection,
  dir: TextDirection
): PortPlacement[] {
  const ports = registry.get(node.type)?.ports ?? [];
  const out: PortPlacement[] = [];
  for (const direction of ['in', 'out'] as const) {
    const list = ports.filter((port) => port.direction === direction);
    list.forEach((port, i) => {
      const t = (i + 1) / (list.length + 1);
      let side: PortPlacement['side'];
      if (flow === 'TB') side = direction === 'in' ? 'top' : 'bottom';
      else side = (direction === 'in') === (dir === 'ltr') ? 'left' : 'right';
      const point =
        side === 'left'
          ? { x: box.x, y: box.y + box.height * t }
          : side === 'right'
            ? { x: box.x + box.width, y: box.y + box.height * t }
            : side === 'top'
              ? { x: box.x + box.width * t, y: box.y }
              : { x: box.x + box.width * t, y: box.y + box.height };
      out.push({ node: node.id, port: port.id, direction, dataType: port.dataType, point, side });
    });
  }
  return out;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** An SVG cubic path leaving `a` along `fromSide` and entering `b` along `toSide`. */
export function edgeCurve(
  a: Point,
  fromSide: PortPlacement['side'],
  b: Point,
  toSide: PortPlacement['side']
): string {
  const reach = Math.max(32, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
  const out = (side: PortPlacement['side'], p: Point, sign: 1 | -1): Point => {
    const d = sign * reach;
    if (side === 'left') return { x: p.x - d, y: p.y };
    if (side === 'right') return { x: p.x + d, y: p.y };
    if (side === 'top') return { x: p.x, y: p.y - d };
    return { x: p.x, y: p.y + d };
  };
  const c1 = out(fromSide, a, 1);
  const c2 = out(toSide, b, 1);
  return `M${round(a.x)} ${round(a.y)}C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(b.x)} ${round(b.y)}`;
}

/** The midpoint of a cubic edge (for its label). */
export function edgeMidpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export interface SceneEdge {
  edge: WorkflowEdge;
  path: string;
  from: Point;
  to: Point;
}

export interface Scene {
  boxes: Map<string, Box>;
  ports: Map<string, PortPlacement>;
  /** Each node's ports in declaration order (inputs, then outputs). */
  nodePorts: Map<string, readonly PortPlacement[]>;
  edges: SceneEdge[];
  bounds: Box;
}

/** The port key used in scenes: `node\u0000port`. Ids never hold NUL. */
export const portKey = (node: string, port: string) => `${node}\u0000${port}`;

export interface SceneOptions {
  flow?: FlowDirection;
  dir?: TextDirection;
  nodeSize?: (node: WorkflowNode) => NodeSize;
  /** World offsets per node (a pointer drag preview), applied without touching the graph. */
  offsets?: ReadonlyMap<string, Point>;
}

export type SceneBuilder = (
  graph: Pick<WorkflowGraph, 'nodes' | 'edges'>,
  registry: NodeTypeRegistry,
  options?: SceneOptions
) => Scene;

interface NodeEntry {
  node: WorkflowNode;
  dx: number;
  dy: number;
  box: Box;
  ports: readonly PortPlacement[];
}

interface EdgeEntry {
  edge: WorkflowEdge;
  from: PortPlacement;
  to: PortPlacement;
  value: SceneEdge;
}

/**
 * A scene builder that remembers its last scene: a node whose object and
 * offset did not change keeps the same box and port objects, and an edge
 * whose ends did not move keeps the same path object. Renderers that compare
 * by identity (Svelte keyed blocks) then touch only what moved, so a drag
 * frame costs O(moved) DOM work. Changing the registry, flow, direction or
 * size function starts the cache over. Each call is still O(nodes + edges).
 */
export function createSceneBuilder(): SceneBuilder {
  let nodes = new Map<string, NodeEntry>();
  let edges = new Map<string, EdgeEntry>();
  let context: unknown[] = [];
  return (graph, registry, options = {}) => {
    const flow = options.flow ?? 'LR';
    const dir = options.dir ?? 'ltr';
    const next = [registry, flow, dir, options.nodeSize];
    if (next.some((value, i) => value !== context[i])) {
      nodes = new Map();
      edges = new Map();
      context = next;
    }
    const boxes = new Map<string, Box>();
    const ports = new Map<string, PortPlacement>();
    const nodePorts = new Map<string, readonly PortPlacement[]>();
    const nodesNext = new Map<string, NodeEntry>();
    for (const node of graph.nodes) {
      const shift = options.offsets?.get(node.id);
      const dx = shift?.x ?? 0;
      const dy = shift?.y ?? 0;
      let entry = nodes.get(node.id);
      if (!entry || entry.node !== node || entry.dx !== dx || entry.dy !== dy) {
        const size = sizeOf(node, options.nodeSize);
        const box = {
          x: node.position.x + dx,
          y: node.position.y + dy,
          width: size.width,
          height: size.height,
        };
        entry = { node, dx, dy, box, ports: portPlacements(node, box, registry, flow, dir) };
      }
      nodesNext.set(node.id, entry);
      boxes.set(node.id, entry.box);
      nodePorts.set(node.id, entry.ports);
      for (const placement of entry.ports)
        ports.set(portKey(placement.node, placement.port), placement);
    }
    nodes = nodesNext;
    const list: SceneEdge[] = [];
    const edgesNext = new Map<string, EdgeEntry>();
    for (const edge of graph.edges) {
      const from = ports.get(portKey(edge.from.node, edge.from.port));
      const to = ports.get(portKey(edge.to.node, edge.to.port));
      if (!from || !to) continue;
      let entry = edges.get(edge.id);
      if (!entry || entry.edge !== edge || entry.from !== from || entry.to !== to) {
        entry = {
          edge,
          from,
          to,
          value: {
            edge,
            from: from.point,
            to: to.point,
            path: edgeCurve(from.point, from.side, to.point, to.side),
          },
        };
      }
      edgesNext.set(edge.id, entry);
      list.push(entry.value);
    }
    edges = edgesNext;
    return { boxes, ports, nodePorts, edges: list, bounds: boundsOfBoxes(boxes.values()) };
  };
}

/**
 * Every box, port point and edge path for a graph, built once (no cache).
 * O(nodes + ports + edges).
 */
export function buildScene(
  graph: Pick<WorkflowGraph, 'nodes' | 'edges'>,
  registry: NodeTypeRegistry,
  options: SceneOptions = {}
): Scene {
  return createSceneBuilder()(graph, registry, options);
}

export function boundsOfBoxes(boxes: Iterable<Box>): Box {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  if (minX === Number.POSITIVE_INFINITY) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export type FocusDirection = 'left' | 'right' | 'up' | 'down';

/**
 * The nearest node in a direction from `from`, by box centers. Nodes inside
 * the 90° cone around the direction win over nodes merely in that
 * half-plane; within a tier the off-axis distance counts double, so the node
 * "most straight ahead" wins. Ties go to the smaller id.
 */
export function nearestInDirection(
  boxes: ReadonlyMap<string, Box>,
  from: string,
  direction: FocusDirection
): string | undefined {
  const origin = boxes.get(from);
  if (!origin) return undefined;
  const ox = origin.x + origin.width / 2;
  const oy = origin.y + origin.height / 2;
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [id, box] of boxes) {
    if (id === from) continue;
    const dx = box.x + box.width / 2 - ox;
    const dy = box.y + box.height / 2 - oy;
    const ahead =
      direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const aside = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (ahead <= 0) continue;
    // Outside the cone: still reachable, but only when nothing is inside it.
    const score = ahead + 2 * aside + (aside > ahead ? 1e9 : 0);
    if (score < bestScore || (score === bestScore && best !== undefined && id < best)) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

/** Scale and offset that fit `content` into a `width × height` box (the minimap). */
export function fitInto(content: Box, width: number, height: number, padding = 8) {
  const scale = Math.min(
    (width - padding * 2) / Math.max(1, content.width),
    (height - padding * 2) / Math.max(1, content.height)
  );
  return {
    scale,
    x: padding + (width - padding * 2 - content.width * scale) / 2 - content.x * scale,
    y: padding + (height - padding * 2 - content.height * scale) / 2 - content.y * scale,
  };
}
