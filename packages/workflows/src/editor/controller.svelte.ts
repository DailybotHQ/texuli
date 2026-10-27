/**
 * The editor's shared state and commands. Every part (canvas, outline,
 * palette, toolbar, minimap, inspector) reads and drives one controller, so a
 * host can compose the parts in any layout, or drive the editor from its own
 * UI. Every change goes through the model's closed ops and history.
 */
import { getAnnouncer } from '@texuli/core/announcer';
import type { DragMessages, DragMessagesOverrides } from '@texuli/drag/messages';
import {
  fitView,
  IDENTITY_VIEW,
  marqueeSelect,
  panBy,
  screenToWorld,
  snapValue,
  type ViewTransform,
  zoomAt,
} from '@texuli/drag/spatial';
import { layoutMoves, layoutWorkflow } from '../layout/index.ts';
import { copyFragment, createNode, prepareFragment } from '../model/fragment.ts';
import {
  createWorkflowHistory,
  type WorkflowEvent,
  type WorkflowHistory,
  type WorkflowValidation,
} from '../model/history.ts';
import { parseWorkflowOp } from '../model/parse.ts';
import type { NodeTypeRegistry } from '../model/registry.ts';
import type {
  NodeMove,
  Point,
  WorkflowError,
  WorkflowFragment,
  WorkflowGraph,
  WorkflowLimits,
  WorkflowNode,
  WorkflowOp,
} from '../model/types.ts';
import { isWorkflowId } from '../model/values.ts';
import { connectCandidates, type PortEnd, type PortTarget } from './connect.ts';
import {
  type Box,
  createSceneBuilder,
  type FlowDirection,
  type FocusDirection,
  type NodeSize,
  nearestInDirection,
  portKey,
  type Scene,
  sizeOf,
  type TextDirection,
} from './geometry.ts';
import {
  formatDragMessage,
  formatLabel,
  type LabelValues,
  resolveWorkflowDragMessages,
  resolveWorkflowLabels,
  type WorkflowLabel,
  type WorkflowLabels,
  type WorkflowLabelsOverrides,
} from './labels.ts';

/** The clipboard text format: `{"texuliWorkflowFragment": {...}}`. */
export const CLIPBOARD_KEY = 'texuliWorkflowFragment';
const MAX_CLIPBOARD_CHARS = 1_000_000;
const ZOOM_STEP = 1.25;
export const ZOOM_LIMITS = Object.freeze({ min: 0.1, max: 4 });

export interface WorkflowControllerOptions {
  graph: WorkflowGraph;
  registry: NodeTypeRegistry;
  limits?: Partial<WorkflowLimits>;
  /** An extra commit gate, run after the model's own checks. */
  validate?: (graph: WorkflowGraph) => WorkflowValidation;
  historyLimit?: number;
  flow?: FlowDirection;
  dir?: TextDirection;
  nodeSize?: (node: WorkflowNode) => NodeSize;
  /** Grid step for snapping and Alt+Arrow nudges. Default 16. */
  grid?: number;
  readonly?: boolean;
  labels?: WorkflowLabelsOverrides;
  messages?: DragMessagesOverrides;
  /** Polite announcements. Defaults to `@texuli/core/announcer`. */
  announce?: (message: string) => void;
  onchange?: (graph: WorkflowGraph, event: WorkflowEvent) => void;
}

export interface ConnectState {
  source: PortEnd;
  candidates: readonly PortTarget[];
  index: number;
}

export type FocusTarget =
  | { kind: 'node'; node: string }
  | { kind: 'port'; node: string; port: string };

export interface Wire {
  from: Point;
  to: Point;
}

export class WorkflowController {
  graph: WorkflowGraph = $state.raw(undefined as unknown as WorkflowGraph);
  registry: NodeTypeRegistry = $state.raw(undefined as unknown as NodeTypeRegistry);
  flow: FlowDirection = $state('LR');
  dir: TextDirection = $state('ltr');
  readonly: boolean = $state(false);
  grid: number = $state(16);
  nodeSize: ((node: WorkflowNode) => NodeSize) | undefined = $state.raw(undefined);
  labels: WorkflowLabels = $state.raw(resolveWorkflowLabels());
  messages: DragMessages = $state.raw(resolveWorkflowDragMessages());

  /** Selected node ids. */
  selection: ReadonlySet<string> = $state.raw(new Set<string>());
  selectedEdge: string | null = $state(null);
  /** The node holding the canvas tab stop. */
  focusId: string | null = $state(null);
  /** Set when a part should move DOM focus; the canvas consumes it. */
  pendingFocus: FocusTarget | null = $state.raw(null);
  view: ViewTransform = $state.raw(IDENTITY_VIEW);
  viewport = $state({ width: 0, height: 0 });
  /**
   * Pointer drag preview: the nodes being dragged and their shared world
   * offset. Never in the graph until dropped; the canvas renders the offset
   * with one CSS transform, so a drag frame does not re-render nodes.
   */
  dragIds: ReadonlySet<string> = $state.raw(new Set());
  dragDelta: Point = $state.raw({ x: 0, y: 0 });
  connect: ConnectState | null = $state.raw(null);
  wire: Wire | null = $state.raw(null);
  /** Marquee rectangle in world units. */
  marquee: Box | null = $state.raw(null);
  canUndo = $state(false);
  canRedo = $state(false);

  #buildScene = createSceneBuilder();
  scene: Scene = $derived.by(() =>
    this.#buildScene(this.graph, this.registry, {
      flow: this.flow,
      dir: this.dir,
      ...(this.nodeSize ? { nodeSize: this.nodeSize } : {}),
    })
  );

  /** The canvas viewport element, set by the canvas (palette drops measure it). */
  viewportElement: HTMLElement | null = null;
  clipboard: WorkflowFragment | null = null;
  #history: WorkflowHistory;
  #options: WorkflowControllerOptions;
  #marqueeStart: Point | null = null;

  constructor(options: WorkflowControllerOptions) {
    this.#options = options;
    this.registry = options.registry;
    this.graph = options.graph;
    this.#history = this.#createHistory(options.graph);
    this.configure(options);
  }

  #createHistory(graph: WorkflowGraph): WorkflowHistory {
    const { registry, limits, validate, historyLimit } = this.#options;
    const history = createWorkflowHistory(graph, {
      registry,
      ...(limits ? { limits } : {}),
      ...(validate ? { validate } : {}),
      ...(historyLimit ? { limit: historyLimit } : {}),
    });
    history.subscribe((event) => {
      this.graph = event.graph;
      this.canUndo = history.canUndo;
      this.canRedo = history.canRedo;
      this.#prune();
      this.#options.onchange?.(event.graph, event);
    });
    return history;
  }

  /** Update presentation options (props that change after mount). */
  configure(options: Partial<Omit<WorkflowControllerOptions, 'graph' | 'registry'>>): void {
    Object.assign(this.#options, options);
    if (options.flow) this.flow = options.flow;
    if (options.dir) this.dir = options.dir;
    if (options.readonly !== undefined) this.readonly = options.readonly;
    if (options.grid !== undefined && options.grid > 0) this.grid = options.grid;
    if ('nodeSize' in options) this.nodeSize = options.nodeSize;
    if ('labels' in options) this.labels = resolveWorkflowLabels(options.labels);
    if ('messages' in options) this.messages = resolveWorkflowDragMessages(options.messages);
  }

  /** Replace the graph (a host loaded another document); history starts over. */
  reset(graph: WorkflowGraph, registry: NodeTypeRegistry = this.registry): void {
    this.#options.registry = registry;
    this.registry = registry;
    this.graph = graph;
    this.#history = this.#createHistory(graph);
    this.canUndo = false;
    this.canRedo = false;
    this.connect = null;
    this.dragIds = new Set();
    this.dragDelta = { x: 0, y: 0 };
    this.#prune();
  }

  get history(): WorkflowHistory {
    return this.#history;
  }

  // -------------------------------------------------------------------------
  // Text

  label(label: WorkflowLabel, values?: LabelValues): string {
    return formatLabel(label, values);
  }

  announce(message: string): void {
    if (message === '') return;
    if (this.#options.announce) {
      this.#options.announce(message);
      return;
    }
    if (typeof document !== 'undefined') getAnnouncer(document).announce(message);
  }

  #refuse(error: WorkflowError): void {
    const reason = formatLabel(
      this.labels.reasons[error.code] ?? this.labels.reasons['invalid-op']
    );
    this.announce(formatLabel(this.labels.refused, { reason }));
  }

  nodeLabel(id: string): string {
    const node = this.graph.nodes.find((candidate) => candidate.id === id);
    if (!node) return id;
    return node.label || this.registry.get(node.type)?.label || node.type;
  }

  portLabel(node: string, port: string): string {
    const type = this.graph.nodes.find((candidate) => candidate.id === node)?.type ?? '';
    return this.registry.port(type, port)?.label ?? port;
  }

  // -------------------------------------------------------------------------
  // Edits

  /** Apply ops as one undoable step. A refusal is announced and returned. */
  apply(ops: WorkflowOp | readonly WorkflowOp[], options: { coalesceKey?: string } = {}) {
    if (this.readonly) {
      const error: WorkflowError = { code: 'invalid-op', message: 'The editor is read-only.' };
      this.#refuse(error);
      return { ok: false as const, error };
    }
    const result = this.#history.apply(ops, options);
    if (!result.ok) this.#refuse(result.error);
    return result;
  }

  undo(): boolean {
    if (this.readonly || !this.#history.undo()) return false;
    this.announce(formatLabel(this.labels.undone));
    return true;
  }

  redo(): boolean {
    if (this.readonly || !this.#history.redo()) return false;
    this.announce(formatLabel(this.labels.redone));
    return true;
  }

  /** Drop selection, focus and modes that point at things that no longer exist. */
  #prune(): void {
    const ids = new Set(this.graph.nodes.map((node) => node.id));
    if ([...this.selection].some((id) => !ids.has(id))) {
      this.selection = new Set([...this.selection].filter((id) => ids.has(id)));
    }
    if (this.selectedEdge && !this.graph.edges.some((edge) => edge.id === this.selectedEdge)) {
      this.selectedEdge = null;
    }
    if (this.focusId !== null && !ids.has(this.focusId)) this.focusId = null;
  }

  /** A fresh id from `base` (`base`, then `base-2`, `base-3`…). */
  uniqueId(base: string): string {
    const clean =
      base
        .replace(/[^A-Za-z0-9_.:-]/g, '-')
        .replace(/^[^A-Za-z0-9]+/, '')
        .slice(0, 56) || 'item';
    const taken = new Set<string>();
    for (const list of [this.graph.nodes, this.graph.edges, this.graph.groups]) {
      for (const item of list) taken.add(item.id);
    }
    if (!taken.has(clean)) return clean;
    for (let n = 2; ; n++) {
      const id = `${clean}-${n}`;
      if (!taken.has(id)) return id;
    }
  }

  #snap(value: number): number {
    return snapValue(value, this.grid);
  }

  /** The world point at the middle of the viewport. */
  viewCenter(): Point {
    return screenToWorld({ x: this.viewport.width / 2, y: this.viewport.height / 2 }, this.view);
  }

  /** Add a node of `type`, centered on `at` (world) or on the view. */
  addNode(type: string, at?: Point): string | undefined {
    if (!this.registry.has(type)) return undefined;
    const id = this.uniqueId(type);
    const probe = createNode(this.registry, type, { id, position: { x: 0, y: 0 } });
    const size = sizeOf(probe, this.nodeSize);
    const center = at ?? this.viewCenter();
    const node = {
      ...probe,
      position: {
        x: this.#snap(center.x - size.width / 2),
        y: this.#snap(center.y - size.height / 2),
      },
    };
    const result = this.apply({ op: 'addNode', node });
    if (!result.ok) return undefined;
    this.select([id]);
    this.focusNode(id);
    this.announce(formatLabel(this.labels.added, { node: this.nodeLabel(id) }));
    return id;
  }

  /** The nodes an action applies to: the selection when it holds the focused node, else the focused node. */
  targets(): string[] {
    if (this.selection.size > 0 && (this.focusId === null || this.selection.has(this.focusId))) {
      return [...this.selection];
    }
    return this.focusId === null ? [] : [this.focusId];
  }

  removeSelection(): void {
    if (this.selectedEdge) {
      const result = this.apply({ op: 'disconnect', id: this.selectedEdge });
      if (result.ok) this.announce(formatLabel(this.labels.disconnected));
      return;
    }
    const ids = this.targets();
    if (ids.length === 0) return;
    const next = this.focusId ? this.#nearestOutside(this.focusId, new Set(ids)) : undefined;
    const result = this.apply(ids.map((id): WorkflowOp => ({ op: 'removeNode', id })));
    if (!result.ok) return;
    this.announce(formatLabel(this.labels.removed, { count: ids.length }));
    this.selection = new Set();
    if (next) this.focusNode(next);
  }

  #nearestOutside(from: string, excluded: ReadonlySet<string>): string | undefined {
    const origin = this.scene.boxes.get(from);
    if (!origin) return undefined;
    let best: string | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [id, box] of this.scene.boxes) {
      if (excluded.has(id)) continue;
      const d = Math.hypot(box.x - origin.x, box.y - origin.y);
      if (d < bestDistance) {
        best = id;
        bestDistance = d;
      }
    }
    return best;
  }

  nudge(direction: FocusDirection, large = false): void {
    const ids = this.targets();
    if (ids.length === 0) return;
    const step = this.grid * (large ? 4 : 1);
    const dx = direction === 'left' ? -step : direction === 'right' ? step : 0;
    const dy = direction === 'up' ? -step : direction === 'down' ? step : 0;
    const moves = ids.flatMap((id): NodeMove[] => {
      const node = this.graph.nodes.find((candidate) => candidate.id === id);
      return node ? [{ id, x: node.position.x + dx, y: node.position.y + dy }] : [];
    });
    const result = this.apply(
      { op: 'moveNodes', moves },
      { coalesceKey: `nudge:${[...ids].sort().join(',')}` }
    );
    if (!result.ok) return;
    const label =
      ids.length === 1
        ? this.nodeLabel(ids[0] as string)
        : formatDragMessage(this.messages.itemsLabel, { count: ids.length });
    this.announce(formatLabel(this.labels.nudged, { node: label }));
    if (this.focusId) this.ensureVisible(this.focusId);
  }

  autoLayout(): void {
    const layout = layoutWorkflow(this.graph, {
      direction: this.flow,
      rtl: this.dir === 'rtl',
      nodeSize: (node) => sizeOf(node, this.nodeSize),
    });
    const result = this.apply({ op: 'moveNodes', moves: layoutMoves(layout) });
    if (result.ok) {
      this.announce(formatLabel(this.labels.laidOut));
      this.fit(false);
    }
  }

  group(): void {
    const ids = this.targets();
    if (ids.length === 0) return;
    const id = this.uniqueId('group');
    const label = formatLabel(this.labels.newGroup, { index: this.graph.groups.length + 1 });
    this.apply({ op: 'group', group: { id, label }, nodes: ids });
  }

  ungroup(): void {
    const node = this.graph.nodes.find((candidate) => candidate.id === this.focusId);
    const group =
      node?.group ??
      this.graph.nodes.find((candidate) => this.selection.has(candidate.id) && candidate.group)
        ?.group;
    if (group) this.apply({ op: 'ungroup', id: group });
  }

  // -------------------------------------------------------------------------
  // Clipboard

  copy(): number {
    const ids = this.targets();
    if (ids.length === 0) return 0;
    this.clipboard = copyFragment(this.graph, ids);
    try {
      void globalThis.navigator?.clipboard
        ?.writeText(JSON.stringify({ [CLIPBOARD_KEY]: this.clipboard }))
        ?.catch(() => undefined);
    } catch {
      // The system clipboard is optional; the editor keeps its own copy.
    }
    this.announce(formatLabel(this.labels.copied, { count: ids.length }));
    return ids.length;
  }

  cut(): void {
    if (this.copy() > 0) this.removeSelection();
  }

  /** Paste a fragment (default: the editor clipboard) under fresh ids, offset by two grid steps. */
  paste(fragment: WorkflowFragment | null = this.clipboard): boolean {
    if (!fragment || fragment.nodes.length === 0) return false;
    const ready = prepareFragment(this.graph, fragment, {
      offset: { x: this.grid * 2, y: this.grid * 2 },
    });
    const result = this.apply({ op: 'paste', fragment: ready });
    if (!result.ok) return false;
    const ids = ready.nodes.map((node) => node.id);
    this.select(ids);
    this.focusNode(ids[0] as string);
    this.clipboard = copyFragment(this.graph, ids);
    this.announce(formatLabel(this.labels.pasted, { count: ids.length }));
    return true;
  }

  /**
   * Paste clipboard text from outside (untrusted): bounded size, then the
   * op shape check, then the model's full checks when applied.
   */
  pasteText(text: string): boolean {
    if (text.length === 0 || text.length > MAX_CLIPBOARD_CHARS) return false;
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return false;
    }
    if (typeof value !== 'object' || value === null || !Object.hasOwn(value, CLIPBOARD_KEY))
      return false;
    const parsed = parseWorkflowOp({
      op: 'paste',
      fragment: (value as Record<string, unknown>)[CLIPBOARD_KEY],
    });
    if (!parsed.ok || parsed.op.op !== 'paste') return false;
    const fragment = parsed.op.fragment;
    if (
      !Array.isArray(fragment.nodes) ||
      !Array.isArray(fragment.edges) ||
      !Array.isArray(fragment.groups)
    )
      return false;
    // A fragment with missing positions or endpoints is refused, never thrown.
    try {
      return this.paste(fragment);
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Selection and focus

  select(ids: Iterable<string>, mode: 'replace' | 'toggle' | 'add' = 'replace'): void {
    const next = mode === 'replace' ? new Set<string>() : new Set(this.selection);
    for (const id of ids) {
      if (mode === 'toggle' && next.has(id)) next.delete(id);
      else next.add(id);
    }
    this.selection = next;
    this.selectedEdge = null;
  }

  selectAll(): void {
    this.select(this.graph.nodes.map((node) => node.id));
    this.announce(formatLabel(this.labels.selection, { count: this.selection.size }));
  }

  toggleSelect(id: string): void {
    this.select([id], 'toggle');
    this.announce(formatLabel(this.labels.selection, { count: this.selection.size }));
  }

  selectEdge(id: string | null): void {
    this.selection = new Set();
    this.selectedEdge = id;
  }

  clearSelection(): void {
    this.selection = new Set();
    this.selectedEdge = null;
  }

  /** Make `id` the canvas tab stop and ask the canvas to focus it. */
  focusNode(id: string): void {
    this.focusId = id;
    this.pendingFocus = { kind: 'node', node: id };
    this.ensureVisible(id);
  }

  focusPort(node: string, port: string): void {
    this.focusId = node;
    this.pendingFocus = { kind: 'port', node, port };
    this.ensureVisible(node);
  }

  moveFocus(direction: FocusDirection): void {
    const from = this.focusId ?? this.graph.nodes[0]?.id;
    if (!from) return;
    const next =
      this.focusId === null ? from : nearestInDirection(this.scene.boxes, from, direction);
    if (next) this.focusNode(next);
  }

  focusEdgeOf(which: 'first' | 'last'): void {
    const nodes = this.graph.nodes;
    const node = which === 'first' ? nodes[0] : nodes[nodes.length - 1];
    if (node) this.focusNode(node.id);
  }

  // -------------------------------------------------------------------------
  // View

  setView(view: ViewTransform): void {
    this.view = view;
  }

  panBy(delta: Point): void {
    this.view = panBy(this.view, delta);
  }

  zoomBy(factor: number, anchor?: Point, announce = true): void {
    const at = anchor ?? { x: this.viewport.width / 2, y: this.viewport.height / 2 };
    this.view = zoomAt(this.view, at, factor, ZOOM_LIMITS);
    if (announce)
      this.announce(formatLabel(this.labels.zoomed, { percent: Math.round(this.view.zoom * 100) }));
  }

  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  fit(announce = true): void {
    if (this.viewport.width <= 0 || this.viewport.height <= 0) return;
    const bounds = this.scene.bounds;
    if (bounds.width === 0 && bounds.height === 0) {
      this.view = IDENTITY_VIEW;
      return;
    }
    this.view = fitView(bounds, this.viewport, 32, { min: ZOOM_LIMITS.min, max: 1 });
    if (announce)
      this.announce(formatLabel(this.labels.zoomed, { percent: Math.round(this.view.zoom * 100) }));
  }

  /** Pan the least needed so a node is inside the viewport. */
  ensureVisible(id: string): void {
    const box = this.scene.boxes.get(id);
    const { width, height } = this.viewport;
    if (!box || width <= 0 || height <= 0) return;
    const { x, y, zoom } = this.view;
    const left = box.x * zoom + x;
    const top = box.y * zoom + y;
    const right = left + box.width * zoom;
    const bottom = top + box.height * zoom;
    const margin = 16;
    let dx = 0;
    let dy = 0;
    if (left < margin) dx = margin - left;
    else if (right > width - margin) dx = Math.max(margin - left, width - margin - right);
    if (top < margin) dy = margin - top;
    else if (bottom > height - margin) dy = Math.max(margin - top, height - margin - bottom);
    if (dx !== 0 || dy !== 0) this.view = panBy(this.view, { x: dx, y: dy });
  }

  // -------------------------------------------------------------------------
  // Pointer drag (a preview offset, one step on drop)

  beginDrag(id: string): void {
    if (this.readonly) return;
    if (!this.selection.has(id)) this.select([id]);
    const ids = [...this.selection].filter((candidate) => {
      const node = this.graph.nodes.find((n) => n.id === candidate);
      return node !== undefined && node.metadata?.locked !== true;
    });
    this.dragDelta = { x: 0, y: 0 };
    this.dragIds = new Set(ids);
    if (ids.length === 0) return;
    this.announce(
      ids.length === 1
        ? formatDragMessage(this.messages.pickedUp, { item: this.nodeLabel(id) })
        : formatDragMessage(this.messages.pickedUpMany, { count: ids.length })
    );
  }

  /** `delta` is pointer travel in screen pixels. */
  updateDrag(delta: Point): void {
    if (this.dragIds.size === 0) return;
    const world = {
      x: this.#snap(delta.x / this.view.zoom),
      y: this.#snap(delta.y / this.view.zoom),
    };
    if (world.x !== this.dragDelta.x || world.y !== this.dragDelta.y) this.dragDelta = world;
  }

  #dragItem(ids: readonly string[]): string {
    return ids.length === 1
      ? this.nodeLabel(ids[0] as string)
      : formatDragMessage(this.messages.itemsLabel, { count: ids.length });
  }

  endDrag(): void {
    const ids = [...this.dragIds];
    const { x, y } = this.dragDelta;
    this.dragIds = new Set();
    this.dragDelta = { x: 0, y: 0 };
    if (ids.length === 0 || (x === 0 && y === 0)) return;
    const moves = ids.flatMap((id): NodeMove[] => {
      const node = this.graph.nodes.find((candidate) => candidate.id === id);
      return node ? [{ id, x: node.position.x + x, y: node.position.y + y }] : [];
    });
    const result = this.apply({ op: 'moveNodes', moves });
    if (!result.ok) return;
    this.announce(
      formatDragMessage(this.messages.dropped, { item: this.#dragItem(ids), count: ids.length })
    );
  }

  cancelDrag(): void {
    const ids = [...this.dragIds];
    this.dragIds = new Set();
    this.dragDelta = { x: 0, y: 0 };
    if (ids.length === 0) return;
    this.announce(
      formatDragMessage(this.messages.cancelled, { item: this.#dragItem(ids), count: ids.length })
    );
  }

  get dragging(): boolean {
    return this.dragIds.size > 0;
  }

  // -------------------------------------------------------------------------
  // Marquee

  beginMarquee(world: Point): void {
    this.#marqueeStart = world;
    this.marquee = { x: world.x, y: world.y, width: 0, height: 0 };
  }

  updateMarquee(world: Point): void {
    const start = this.#marqueeStart;
    if (!start) return;
    this.marquee = {
      x: Math.min(start.x, world.x),
      y: Math.min(start.y, world.y),
      width: Math.abs(world.x - start.x),
      height: Math.abs(world.y - start.y),
    };
  }

  endMarquee(additive = false): void {
    const box = this.marquee;
    this.#marqueeStart = null;
    this.marquee = null;
    if (!box) return;
    const placed = [...this.scene.boxes].map(([id, rect]) => ({ id, rect }));
    const ids = marqueeSelect(
      { x: box.x, y: box.y },
      { x: box.x + box.width, y: box.y + box.height },
      placed
    );
    this.select(ids, additive ? 'add' : 'replace');
    this.announce(formatLabel(this.labels.selection, { count: this.selection.size }));
  }

  // -------------------------------------------------------------------------
  // Connect mode

  startConnect(node: string, port: string): void {
    if (this.readonly) return;
    const type = this.graph.nodes.find((candidate) => candidate.id === node)?.type ?? '';
    const spec = this.registry.port(type, port);
    if (!spec) return;
    const source: PortEnd = { node, port, direction: spec.direction };
    const candidates = connectCandidates(this.graph, this.registry, source, this.scene.ports);
    const values = {
      port: this.portLabel(node, port),
      node: this.nodeLabel(node),
      total: candidates.length,
    };
    if (candidates.length === 0) {
      this.announce(formatLabel(this.labels.connectNone, values));
      return;
    }
    this.connect = { source, candidates, index: 0 };
    this.announce(`${formatLabel(this.labels.connectStart, values)} ${this.#candidateText()}`);
    this.#focusCandidate();
  }

  #candidateText(): string {
    const state = this.connect;
    const target = state?.candidates[state.index];
    if (!state || !target) return '';
    return formatLabel(this.labels.connectCandidate, {
      port: this.portLabel(target.node, target.port),
      node: this.nodeLabel(target.node),
      index: state.index + 1,
      total: state.candidates.length,
    });
  }

  #focusCandidate(): void {
    const target = this.connect?.candidates[this.connect.index];
    if (!target) return;
    this.pendingFocus = { kind: 'port', node: target.node, port: target.port };
    this.ensureVisible(target.node);
  }

  cycleConnect(step: 1 | -1): void {
    const state = this.connect;
    if (!state) return;
    const total = state.candidates.length;
    this.connect = { ...state, index: (state.index + step + total) % total };
    this.announce(this.#candidateText());
    this.#focusCandidate();
  }

  /** Connect the source to `target` (default: the current candidate). */
  commitConnect(target?: PortTarget): boolean {
    const state = this.connect;
    const to = target ?? state?.candidates[state.index];
    if (!state || !to) return false;
    const { source } = state;
    const [from, end] =
      source.direction === 'out'
        ? [{ node: source.node, port: source.port }, to]
        : [to, { node: source.node, port: source.port }];
    const id = this.uniqueId(`${from.node}-${end.node}`);
    this.connect = null;
    this.wire = null;
    const result = this.apply({ op: 'connect', edge: { id, from, to: end } });
    this.focusPort(source.node, source.port);
    if (!result.ok) return false;
    this.announce(
      formatLabel(this.labels.connected, {
        port: this.portLabel(from.node, from.port),
        target: `${this.portLabel(end.node, end.port)}, ${this.nodeLabel(end.node)}`,
      })
    );
    return true;
  }

  cancelConnect(): void {
    const state = this.connect;
    this.connect = null;
    this.wire = null;
    if (!state) return;
    this.focusPort(state.source.node, state.source.port);
    this.announce(formatLabel(this.labels.connectCancelled));
  }

  /** Pointer connect: start a wire from a port (candidates computed once). */
  startWire(node: string, port: string): boolean {
    if (this.readonly) return false;
    const type = this.graph.nodes.find((candidate) => candidate.id === node)?.type ?? '';
    const spec = this.registry.port(type, port);
    const placement = this.scene.ports.get(portKey(node, port));
    if (!spec || !placement) return false;
    const source: PortEnd = { node, port, direction: spec.direction };
    this.connect = {
      source,
      candidates: connectCandidates(this.graph, this.registry, source, this.scene.ports),
      index: -1,
    };
    this.wire = { from: placement.point, to: placement.point };
    return true;
  }

  updateWire(world: Point): void {
    if (this.wire) this.wire = { from: this.wire.from, to: world };
  }

  /** Drop a wire at `world`: the nearest candidate port within `radius` (screen px) connects. */
  endWire(world: Point, radius = 20): boolean {
    const state = this.connect;
    if (!state) return false;
    const limit = radius / this.view.zoom;
    let best: PortTarget | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of state.candidates) {
      const point = this.scene.ports.get(portKey(candidate.node, candidate.port))?.point;
      if (!point) continue;
      const d = Math.hypot(point.x - world.x, point.y - world.y);
      if (d <= limit && d < bestDistance) {
        best = candidate;
        bestDistance = d;
      }
    }
    if (!best) {
      this.connect = null;
      this.wire = null;
      return false;
    }
    return this.commitConnect(best);
  }

  isCandidate(node: string, port: string): boolean {
    return (
      this.connect?.candidates.some((target) => target.node === node && target.port === port) ??
      false
    );
  }

  /** Does an id look like one this model accepts? (Hosts validating their own input.) */
  static isId(value: unknown): value is string {
    return isWorkflowId(value);
  }
}
