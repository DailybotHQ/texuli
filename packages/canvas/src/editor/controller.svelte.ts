/**
 * The canvas editor's state and commands. The document lives in a backend:
 * a local op-log history, or a `CanvasSync` session (collaboration). Every
 * change is a batch of canvas operations; the controller tracks the view,
 * the selection, the focused shape, the active tool, text editing and
 * keyboard connect mode, and announces what happened.
 */
import { getAnnouncer } from '@texuli/core/announcer';
import type { HrefTrust } from '@texuli/core/url-policy';
import { fitView, IDENTITY_VIEW, type ViewTransform, zoomAt } from '@texuli/drag/spatial';
import {
  type AlignMode,
  alignOps,
  applyCanvasOps,
  type CanvasApplyResult,
  type CanvasDocument,
  type CanvasOperation,
  type CanvasRect,
  type CanvasShape,
  type CanvasXY,
  canvasBounds,
  connectOps,
  copyShapes,
  createCanvasHistory,
  createIdFactory,
  deleteOps,
  distributeOps,
  duplicateOps,
  groupOps,
  indexShapes,
  moveOps,
  parseClipboard,
  pasteOps,
  readingOrder,
  reorderOps,
  resizeOps,
  rotateOps,
  type SnapGuide,
  serializeClipboard,
  shapeBounds,
  shapeName,
  textOps,
  ungroupOps,
  walkShapes,
} from '../model/index.ts';
import type { CanvasSync } from '../sync/session.ts';
import { type CanvasTool, type Direction, directionDelta } from './keyboard.ts';
import {
  type CanvasLabel,
  type CanvasLabels,
  type CanvasLabelValues,
  formatCanvasLabel,
} from './labels.ts';

/** Where the document lives: a local history or a sync session. */
export interface CanvasBackend {
  readonly doc: CanvasDocument;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  apply(
    ops: readonly CanvasOperation[],
    options?: { label?: string; merge?: string }
  ): CanvasApplyResult;
  undo(): boolean;
  redo(): boolean;
  /** Remote changes (sync sessions). */
  subscribe?(listener: () => void): () => void;
}

/** A local backend: the op-log history. */
export function historyBackend(doc: CanvasDocument, trust: HrefTrust = 'untrusted'): CanvasBackend {
  const history = createCanvasHistory(doc, { trust });
  return {
    get doc() {
      return history.doc;
    },
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    },
    apply: (ops, options) => history.apply(ops, options),
    undo: () => history.undo() !== null,
    redo: () => history.redo() !== null,
  };
}

/** A collaborative backend over a sync session (undo is the CRDT's selective undo). */
export function syncBackend(sync: CanvasSync): CanvasBackend {
  return {
    get doc() {
      return sync.canvas;
    },
    get canUndo() {
      return sync.canUndo;
    },
    get canRedo() {
      return sync.canRedo;
    },
    apply: (ops) => sync.apply(ops),
    undo: () => sync.undo(),
    redo: () => sync.redo(),
    subscribe: (listener) => sync.subscribe(() => listener()),
  };
}

export interface CanvasControllerOptions {
  backend: CanvasBackend;
  labels: CanvasLabels;
  readonly?: boolean;
  dir?: 'ltr' | 'rtl';
  /** Snap moves and new shapes to the grid and other shapes (default true). */
  snap?: boolean;
  /** Called after every change with the new document. */
  onchange?: (doc: CanvasDocument) => void;
  /** Announce through this instead of the shared live region (tests). */
  announce?: (message: string) => void;
}

/** The size a shape gets when it is created without a drag. */
export const DEFAULT_SIZES: Readonly<Record<string, { width: number; height: number }>> =
  Object.freeze({
    rect: { width: 160, height: 96 },
    ellipse: { width: 140, height: 96 },
    diamond: { width: 120, height: 120 },
    text: { width: 200, height: 40 },
    sticky: { width: 160, height: 160 },
    frame: { width: 480, height: 320 },
    line: { width: 160, height: 0 },
    arrow: { width: 160, height: 0 },
  });

const ZOOM_STEP = 1.25;
export const ZOOM_LIMITS = Object.freeze({ min: 0.1, max: 8 });

export class CanvasController {
  doc = $state.raw<CanvasDocument>() as CanvasDocument;
  view = $state.raw<ViewTransform>(IDENTITY_VIEW);
  viewport = $state({ width: 0, height: 0 });
  selection = $state.raw<ReadonlySet<string>>(new Set());
  focusId = $state<string | null>(null);
  tool = $state<CanvasTool>('select');
  editing = $state<string | null>(null);
  guides = $state.raw<SnapGuide[]>([]);
  marquee = $state.raw<CanvasRect | null>(null);
  /** A shape being drawn (preview only, not in the document). */
  draft = $state.raw<CanvasShape | null>(null);
  /** Keyboard connect mode: the source shape and the current target. */
  connecting = $state.raw<{ from: string; target: string | null } | null>(null);
  /** Pointer drag offset of the selection (preview, world units). */
  dragOffset = $state.raw<CanvasXY>({ x: 0, y: 0 });
  /** Ask the surface to focus a shape (or the surface with `''`). */
  pendingFocus = $state<string | null>(null);
  /** Ask the view to animate its next change (keyboard and buttons, not wheel or drag). */
  animateNext = false;
  canUndo = $state(false);
  canRedo = $state(false);
  readonly = $state(false);
  dir = $state<'ltr' | 'rtl'>('ltr');
  snap = $state(true);
  labels: CanvasLabels;

  #backend: CanvasBackend;
  #onchange?: (doc: CanvasDocument) => void;
  #announce?: (message: string) => void;
  #clipboard: string | null = null;
  #off: (() => void) | undefined;

  constructor(options: CanvasControllerOptions) {
    this.#backend = options.backend;
    this.labels = options.labels;
    this.readonly = options.readonly ?? false;
    this.dir = options.dir ?? 'ltr';
    this.snap = options.snap ?? true;
    this.#onchange = options.onchange;
    this.#announce = options.announce;
    this.doc = this.#backend.doc;
    this.#sync();
    this.#off = this.#backend.subscribe?.(() => {
      this.doc = this.#backend.doc;
      this.#sync();
      this.#prune();
    });
  }

  destroy(): void {
    this.#off?.();
  }

  get grid(): number {
    return this.doc.grid ?? 8;
  }

  /** Reading order of every shape (the Tab order and the shape list order). */
  get order(): string[] {
    return readingOrder(this.doc, this.dir);
  }

  #sync(): void {
    this.canUndo = this.#backend.canUndo;
    this.canRedo = this.#backend.canRedo;
  }

  /** Drop selection and focus that point at removed items (after remote edits or undo). */
  #prune(): void {
    const shapes = indexShapes(this.doc);
    const connectors = new Set(this.doc.connectors.map((c) => c.id));
    const alive = (id: string) => shapes.has(id) || connectors.has(id);
    if ([...this.selection].some((id) => !alive(id)))
      this.selection = new Set([...this.selection].filter(alive));
    if (this.focusId !== null && !alive(this.focusId)) this.focusId = null;
    if (this.editing !== null && !shapes.has(this.editing)) this.editing = null;
  }

  label(label: CanvasLabel, values: CanvasLabelValues = {}): string {
    return formatCanvasLabel(label, values);
  }

  announce(message: string): void {
    if (!message) return;
    if (this.#announce) this.#announce(message);
    else if (typeof document !== 'undefined') getAnnouncer(document).announce(message);
  }

  /** A readable name for a shape or connector. */
  nameOf(id: string): string {
    const entry = indexShapes(this.doc).get(id);
    if (entry) {
      const text = shapeName(entry.shape);
      return text || this.label(this.labels.kinds[entry.shape.type] ?? entry.shape.type);
    }
    const connector = this.doc.connectors.find((c) => c.id === id);
    if (connector) {
      const end = (e: typeof connector.from) =>
        'shape' in e ? this.nameOf(e.shape) : `${Math.round(e.x)}, ${Math.round(e.y)}`;
      return this.label(this.labels.connector, {
        name: end(connector.from),
        target: end(connector.to),
      });
    }
    return id;
  }

  /** Apply a batch; announce `message` when it applied, the refusal otherwise. */
  apply(ops: readonly CanvasOperation[], message?: string, merge?: string): boolean {
    if (this.readonly || ops.length === 0) return false;
    const result = this.#backend.apply(ops, { label: message, merge });
    if (!result.ok) {
      this.announce(this.label(this.labels.refused));
      return false;
    }
    this.doc = this.#backend.doc;
    this.#sync();
    this.#prune();
    this.#onchange?.(this.doc);
    if (message) this.announce(message);
    return true;
  }

  /** Replace the document from outside (a bound prop changed); local history only. */
  replace(doc: CanvasDocument): void {
    if (doc === this.doc) return;
    this.#backend = historyBackend(doc);
    this.doc = doc;
    this.#sync();
    this.#prune();
  }

  undo(): void {
    if (this.readonly || !this.#backend.undo()) return;
    this.doc = this.#backend.doc;
    this.#sync();
    this.#prune();
    this.#onchange?.(this.doc);
    this.announce(this.label(this.labels.undone));
  }

  redo(): void {
    if (this.readonly || !this.#backend.redo()) return;
    this.doc = this.#backend.doc;
    this.#sync();
    this.#prune();
    this.#onchange?.(this.doc);
    this.announce(this.label(this.labels.redone));
  }

  // ── selection and focus ───────────────────────────────────────────────

  select(ids: Iterable<string>, announce = true): void {
    this.selection = new Set(ids);
    if (announce) this.#announceSelection();
  }

  toggle(id: string): void {
    const next = new Set(this.selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selection = next;
    this.#announceSelection();
  }

  clearSelection(): void {
    if (this.selection.size === 0) return;
    this.selection = new Set();
    this.announce(this.label(this.labels.selectionCleared));
  }

  selectAll(): void {
    this.select(this.doc.shapes.map((shape) => shape.id));
  }

  #announceSelection(): void {
    const count = this.selection.size;
    if (count === 0) {
      this.announce(this.label(this.labels.selectionCleared));
      return;
    }
    const first = [...this.selection][0] as string;
    this.announce(this.label(this.labels.selected, { count, name: this.nameOf(first) }));
  }

  /** Shape ids the commands act on: the selection, else the focused shape. */
  targets(): string[] {
    const shapes = indexShapes(this.doc);
    const selected = [...this.selection].filter((id) => shapes.has(id));
    if (selected.length > 0) return selected;
    return this.focusId !== null && shapes.has(this.focusId) ? [this.focusId] : [];
  }

  /** Focus (and select) the next or previous shape in reading order. */
  step(delta: 1 | -1): boolean {
    const order = this.order;
    if (order.length === 0) return false;
    const at = this.focusId === null ? -1 : order.indexOf(this.focusId);
    const next = at === -1 ? (delta === 1 ? 0 : order.length - 1) : at + delta;
    if (next < 0 || next >= order.length) return false;
    const id = order[next] as string;
    this.focusId = id;
    this.pendingFocus = id;
    if (this.connecting) {
      this.connecting = { ...this.connecting, target: id === this.connecting.from ? null : id };
      if (id !== this.connecting.from)
        this.announce(this.label(this.labels.connectTarget, { name: this.nameOf(id) }));
    } else this.select([id]);
    this.reveal(id);
    return true;
  }

  // ── geometry commands ─────────────────────────────────────────────────

  #step(fine: boolean): number {
    return fine ? 1 : this.grid;
  }

  nudge(direction: Direction, fine = false): void {
    const ids = this.targets();
    if (ids.length === 0) return;
    const delta = directionDelta(direction, this.#step(fine));
    const ops = moveOps(this.doc, ids, delta);
    const box = canvasBounds(this.doc, ids);
    this.apply(
      ops,
      this.label(this.labels.moved, {
        name: ids.length === 1 ? this.nameOf(ids[0] as string) : `${ids.length}`,
        x: Math.round(box.x + delta.x),
        y: Math.round(box.y + delta.y),
      }),
      `nudge:${ids.join(',')}`
    );
    this.reveal(ids[0] as string);
  }

  /** Shift+arrow: right and down grow, left and up shrink (the start edges stay). */
  resizeBy(direction: Direction, fine = false): void {
    const ids = this.targets();
    if (ids.length !== 1) return;
    const id = ids[0] as string;
    const step = this.#step(fine);
    const handle = direction === 'left' || direction === 'right' ? 'e' : 's';
    const delta = directionDelta(direction, step);
    const ops = resizeOps(this.doc, id, handle, delta, { min: 4 });
    const entry = indexShapes(this.doc).get(id);
    if (!entry) return;
    const before = shapeBounds(entry.shape);
    const width = Math.max(4, Math.round(before.width + (handle === 'e' ? delta.x : 0)));
    const height = Math.max(4, Math.round(before.height + (handle === 's' ? delta.y : 0)));
    this.apply(
      ops,
      this.label(this.labels.resized, { name: this.nameOf(id), width, height }),
      `resize:${id}`
    );
  }

  rotateBy(degrees: number): void {
    const ids = this.targets();
    if (ids.length !== 1) return;
    const id = ids[0] as string;
    const shape = indexShapes(this.doc).get(id)?.shape;
    if (!shape || shape.type === 'group') return;
    const next = (shape.rotation ?? 0) + degrees;
    const ops = rotateOps(this.doc, id, next);
    const angle = ((Math.round(next) % 360) + 360) % 360;
    this.apply(
      ops,
      this.label(this.labels.rotated, { name: this.nameOf(id), degrees: angle }),
      `rotate:${id}`
    );
  }

  moveSelectionBy(delta: CanvasXY): void {
    const ids = this.targets();
    this.apply(
      moveOps(this.doc, ids, delta),
      this.label(this.labels.moved, {
        name: ids.length === 1 ? this.nameOf(ids[0] as string) : `${ids.length}`,
        x: Math.round(canvasBounds(this.doc, ids).x + delta.x),
        y: Math.round(canvasBounds(this.doc, ids).y + delta.y),
      })
    );
  }

  removeSelection(): void {
    const ids = [...new Set([...this.selection, ...(this.focusId ? [this.focusId] : [])])];
    const ops = deleteOps(this.doc, this.selection.size > 0 ? this.selection : ids);
    if (ops.length === 0) return;
    const order = this.order;
    const at = this.focusId ? order.indexOf(this.focusId) : -1;
    if (this.apply(ops, this.label(this.labels.removed, { count: ops.length }))) {
      this.selection = new Set();
      const after = this.order;
      const next = after[Math.min(Math.max(0, at), after.length - 1)] ?? null;
      this.focusId = next;
      this.pendingFocus = next ?? '';
    }
  }

  group(): void {
    const ids = this.targets();
    const id = createIdFactory(this.doc)('g');
    if (
      this.apply(
        groupOps(this.doc, ids, id),
        this.label(this.labels.grouped, { count: ids.length })
      )
    ) {
      this.select([id], false);
      this.focusId = id;
      this.pendingFocus = id;
    }
  }

  ungroup(): void {
    const id = this.targets().find(
      (each) => indexShapes(this.doc).get(each)?.shape.type === 'group'
    );
    if (!id) return;
    const group = indexShapes(this.doc).get(id)?.shape;
    const children = group?.type === 'group' ? group.children.map((child) => child.id) : [];
    if (
      this.apply(
        ungroupOps(this.doc, id),
        this.label(this.labels.ungrouped, { count: children.length })
      )
    ) {
      this.select(children, false);
      this.focusId = children[0] ?? null;
      this.pendingFocus = this.focusId;
    }
  }

  reorder(mode: 'front' | 'back' | 'forward' | 'backward'): void {
    this.apply(reorderOps(this.doc, this.targets(), mode), this.label(this.labels.reordered));
  }

  align(mode: AlignMode): void {
    this.apply(alignOps(this.doc, this.targets(), mode), this.label(this.labels.reordered));
  }

  distribute(axis: 'horizontal' | 'vertical'): void {
    this.apply(distributeOps(this.doc, this.targets(), axis), this.label(this.labels.reordered));
  }

  // ── clipboard ─────────────────────────────────────────────────────────

  /** Copy the selection as JSON; returns the text (the surface also writes the system clipboard). */
  copy(): string | null {
    const ids = this.targets();
    if (ids.length === 0) return null;
    const text = serializeClipboard(copyShapes(this.doc, ids));
    this.#clipboard = text;
    this.announce(this.label(this.labels.copied, { count: ids.length }));
    return text;
  }

  cut(): string | null {
    const text = this.copy();
    if (text) this.removeSelection();
    return text;
  }

  /** Paste JSON text (untrusted: validated first); without text, the last copy. */
  paste(text: string | null = this.#clipboard): boolean {
    if (this.readonly || !text) return false;
    const parsed = parseClipboard(text);
    if (!parsed.ok) {
      this.announce(this.label(this.labels.pasteRefused));
      return false;
    }
    const { ops, ids } = pasteOps(this.doc, parsed.clip, {
      offset: { x: this.grid * 2, y: this.grid * 2 },
    });
    if (!this.apply(ops, this.label(this.labels.pasted, { count: ids.length }))) return false;
    this.#clipboard = serializeClipboard({ ...parsed.clip, shapes: parsed.clip.shapes });
    this.select(ids, false);
    this.focusId = ids[0] ?? null;
    this.pendingFocus = this.focusId;
    return true;
  }

  duplicate(): void {
    const { ops, ids } = duplicateOps(this.doc, this.targets(), {
      x: this.grid * 2,
      y: this.grid * 2,
    });
    if (this.apply(ops, this.label(this.labels.pasted, { count: ids.length }))) {
      this.select(ids, false);
      this.focusId = ids[0] ?? null;
      this.pendingFocus = this.focusId;
    }
  }

  // ── creating ──────────────────────────────────────────────────────────

  /** Add a shape and focus it. Returns its id. */
  add(
    shape: Omit<CanvasShape, 'id'> & { id?: string },
    parent: string | null = null
  ): string | null {
    const id = shape.id ?? createIdFactory(this.doc)(shape.type === 'group' ? 'g' : 's');
    const full = { ...shape, id } as CanvasShape;
    const name = shapeName(full) || this.label(this.labels.kinds[full.type] ?? full.type);
    if (!this.apply([{ op: 'add', shape: full, parent }], this.label(this.labels.added, { name })))
      return null;
    this.select([id], false);
    this.focusId = id;
    this.pendingFocus = id;
    return id;
  }

  /** A shape of the active tool at a world point (keyboard Enter: the view center). */
  createAt(point: CanvasXY, size?: { width: number; height: number }): string | null {
    const tool = this.tool;
    const base = DEFAULT_SIZES[tool];
    if (!base) return null;
    const width = Math.max(size?.width ?? base.width, tool === 'line' || tool === 'arrow' ? 0 : 8);
    const height = Math.max(
      size?.height ?? base.height,
      tool === 'line' || tool === 'arrow' ? 0 : 8
    );
    const snap = (value: number) =>
      this.snap ? Math.round(value / this.grid) * this.grid : Math.round(value);
    const x = snap(point.x - (size ? 0 : width / 2));
    const y = snap(point.y - (size ? 0 : height / 2));
    let shape: Omit<CanvasShape, 'id'>;
    if (tool === 'line' || tool === 'arrow')
      shape = {
        type: tool,
        x,
        y,
        width,
        height,
        points: [
          [0, 0],
          [width, height],
        ],
      } as Omit<CanvasShape, 'id'>;
    else if (tool === 'text')
      shape = { type: 'text', x, y, width, height, text: '' } as Omit<CanvasShape, 'id'>;
    else if (tool === 'sticky')
      shape = { type: 'sticky', x, y, width, height, text: '' } as Omit<CanvasShape, 'id'>;
    else if (tool === 'frame')
      shape = { type: 'frame', x, y, width, height, children: [] } as Omit<CanvasShape, 'id'>;
    else shape = { type: tool, x, y, width, height } as Omit<CanvasShape, 'id'>;
    const id = this.add(shape);
    if (id && (tool === 'text' || tool === 'sticky')) this.startEdit(id);
    this.tool = 'select';
    return id;
  }

  /** The center of the viewport in world units. */
  viewCenter(): CanvasXY {
    const { x, y, zoom } = this.view;
    return { x: (this.viewport.width / 2 - x) / zoom, y: (this.viewport.height / 2 - y) / zoom };
  }

  chooseTool(tool: CanvasTool): void {
    if (this.readonly && tool !== 'select' && tool !== 'hand') return;
    this.tool = tool;
    this.announce(
      this.label(this.labels.toolChosen, { tool: this.label(this.labels.tools[tool]) })
    );
  }

  // ── text ──────────────────────────────────────────────────────────────

  canEdit(id: string): boolean {
    const shape = indexShapes(this.doc).get(id)?.shape;
    return (
      !this.readonly &&
      !!shape &&
      !shape.locked &&
      (shape.type === 'rect' ||
        shape.type === 'ellipse' ||
        shape.type === 'diamond' ||
        shape.type === 'text' ||
        shape.type === 'sticky' ||
        shape.type === 'frame')
    );
  }

  startEdit(id: string): void {
    if (!this.canEdit(id)) return;
    this.editing = id;
    this.announce(this.label(this.labels.editing, { name: this.nameOf(id) }));
  }

  commitText(id: string, text: string): void {
    this.editing = null;
    const entry = indexShapes(this.doc).get(id);
    if (!entry) return;
    const current =
      entry.shape.type === 'frame'
        ? (entry.shape.title ?? '')
        : 'text' in entry.shape
          ? (entry.shape.text ?? '')
          : '';
    if (current !== text) this.apply(textOps(this.doc, id, text));
    this.focusId = id;
    this.pendingFocus = id;
  }

  cancelEdit(): void {
    const id = this.editing;
    this.editing = null;
    if (id) this.pendingFocus = id;
  }

  // ── connecting ────────────────────────────────────────────────────────

  startConnect(from: string): void {
    const shape = indexShapes(this.doc).get(from)?.shape;
    if (this.readonly || !shape || shape.type === 'group') return;
    this.connecting = { from, target: null };
    this.announce(this.label(this.labels.connectStart, { name: this.nameOf(from) }));
  }

  commitConnect(target = this.connecting?.target ?? null): boolean {
    const state = this.connecting;
    this.connecting = null;
    if (!state || !target || target === state.from) {
      this.announce(this.label(this.labels.connectCancelled));
      return false;
    }
    const to = indexShapes(this.doc).get(target)?.shape;
    if (!to || to.type === 'group') {
      this.announce(this.label(this.labels.connectCancelled));
      return false;
    }
    const id = createIdFactory(this.doc)('c');
    return this.apply(
      connectOps({ shape: state.from }, { shape: target }, id, { routing: 'elbow' }),
      this.label(this.labels.connected, {
        name: this.nameOf(state.from),
        target: this.nameOf(target),
      })
    );
  }

  cancelConnect(): void {
    if (!this.connecting) return;
    const from = this.connecting.from;
    this.connecting = null;
    this.focusId = from;
    this.pendingFocus = from;
    this.announce(this.label(this.labels.connectCancelled));
  }

  /** Connect two ends from a pointer drag (shapes or free points). */
  connectEnds(from: { shape: string } | CanvasXY, to: { shape: string } | CanvasXY): boolean {
    const id = createIdFactory(this.doc)('c');
    const end = (e: { shape: string } | CanvasXY) =>
      'shape' in e ? { shape: e.shape } : { x: Math.round(e.x), y: Math.round(e.y) };
    return this.apply(
      connectOps(end(from), end(to), id, { routing: 'curved' }),
      this.label(this.labels.added, { name: this.label(this.labels.kinds.arrow ?? 'Connector') })
    );
  }

  // ── view ──────────────────────────────────────────────────────────────

  setView(view: ViewTransform, animate = false): void {
    this.animateNext = animate;
    this.view = view;
  }

  panBy(delta: CanvasXY, animate = false): void {
    this.setView({ ...this.view, x: this.view.x + delta.x, y: this.view.y + delta.y }, animate);
  }

  zoomBy(factor: number, anchor?: CanvasXY, animate = true): void {
    const center = anchor ?? { x: this.viewport.width / 2, y: this.viewport.height / 2 };
    this.setView(zoomAt(this.view, center, factor, ZOOM_LIMITS), animate);
    if (animate)
      this.announce(this.label(this.labels.zoomed, { percent: Math.round(this.view.zoom * 100) }));
  }

  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  zoomReset(): void {
    this.zoomBy(1 / this.view.zoom);
  }

  /** Fit everything (or `ids`) into the viewport. */
  fit(ids?: Iterable<string>, animate = true): void {
    if (this.viewport.width <= 0 || this.viewport.height <= 0) return;
    const shapes = walkShapes(this.doc);
    if (shapes.length === 0) {
      this.setView(IDENTITY_VIEW, animate);
      return;
    }
    const bounds = canvasBounds(this.doc, ids);
    const view = fitView(bounds, this.viewport, 32, { min: ZOOM_LIMITS.min, max: 2 });
    this.setView(view, animate);
    if (animate)
      this.announce(this.label(this.labels.zoomed, { percent: Math.round(view.zoom * 100) }));
  }

  /** Pan just enough to show a shape. */
  reveal(id: string): void {
    const entry = indexShapes(this.doc).get(id);
    if (!entry || this.viewport.width <= 0) return;
    const b = shapeBounds(entry.shape);
    const { x, y, zoom } = this.view;
    const left = b.x * zoom + x;
    const top = b.y * zoom + y;
    const right = (b.x + b.width) * zoom + x;
    const bottom = (b.y + b.height) * zoom + y;
    const pad = 24;
    let dx = 0;
    let dy = 0;
    if (right > this.viewport.width - pad) dx = this.viewport.width - pad - right;
    if (left + dx < pad) dx = pad - left;
    if (bottom > this.viewport.height - pad) dy = this.viewport.height - pad - bottom;
    if (top + dy < pad) dy = pad - top;
    if (dx !== 0 || dy !== 0) this.panBy({ x: dx, y: dy }, false);
  }

  /** Validate a candidate batch without applying it (dry run for previews). */
  check(ops: readonly CanvasOperation[]): boolean {
    return applyCanvasOps(this.doc, ops).ok;
  }
}
