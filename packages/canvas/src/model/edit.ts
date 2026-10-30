/**
 * Editing as operations: every helper reads a canvas and returns the batch
 * (`CanvasOperation[]`) that makes the change, which `applyCanvasOps` or a
 * history applies (and the sync binding turns into CRDT edits). Helpers
 * skip locked shapes, never throw on unknown ids, and are linear in the
 * canvas plus the selection.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import { type ResizeHandle, resizeRect, snapToGuides } from '@texuli/drag/spatial';
import {
  indexShapes,
  isContainer,
  rotatePoint,
  shapeBounds,
  subtreeIds,
  unionRects,
  type WalkEntry,
  walkShapes,
} from './document.ts';
import { CANVAS_LIMITS } from './limits.ts';
import type { CanvasOperation, CanvasPatch } from './ops.ts';
import { type CanvasValidation, validateCanvas } from './schema.ts';
import type {
  CanvasConnector,
  CanvasDocument,
  CanvasEndpoint,
  CanvasRect,
  CanvasRouting,
  CanvasShape,
  CanvasXY,
} from './types.ts';

export type { ResizeHandle };

/** Ids that are not inside another selected shape, in document order, unlocked. */
export function selectionRoots(doc: CanvasDocument, ids: Iterable<string>): WalkEntry[] {
  const wanted = new Set(ids);
  const out: WalkEntry[] = [];
  const index = indexShapes(doc);
  for (const entry of walkShapes(doc)) {
    if (!wanted.has(entry.shape.id)) continue;
    let ancestor = entry.parent;
    let inside = false;
    while (ancestor) {
      if (wanted.has(ancestor.id)) {
        inside = true;
        break;
      }
      ancestor = index.get(ancestor.id)?.parent ?? null;
    }
    if (!inside) out.push(entry);
  }
  return out;
}

const round = (value: number) => Math.round(value * 100) / 100;
const clampCoord = (value: number) =>
  Math.max(-CANVAS_LIMITS.coordinate, Math.min(CANVAS_LIMITS.coordinate, round(value)));

/** `update` operations that move a shape and everything inside it. */
function translateOps(shape: CanvasShape, dx: number, dy: number): CanvasOperation[] {
  const out: CanvasOperation[] = [];
  const stack: CanvasShape[] = [shape];
  while (stack.length > 0) {
    const current = stack.pop() as CanvasShape;
    if (current.type !== 'group')
      out.push({
        op: 'update',
        id: current.id,
        set: { x: clampCoord(current.x + dx), y: clampCoord(current.y + dy) },
      });
    if (isContainer(current)) stack.push(...current.children);
  }
  return out;
}

/** Move shapes by a world delta (children of frames and groups move with them). */
export function moveOps(
  doc: CanvasDocument,
  ids: Iterable<string>,
  delta: CanvasXY
): CanvasOperation[] {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return [];
  if (delta.x === 0 && delta.y === 0) return [];
  return selectionRoots(doc, ids)
    .filter((entry) => !entry.shape.locked)
    .flatMap((entry) => translateOps(entry.shape, delta.x, delta.y));
}

export interface SnapOptions {
  /** Grid step in world units (0 or absent: no grid). */
  grid?: number;
  /** Snap to the edges and centers of other shapes. Default true. */
  objects?: boolean;
  /** Distance in world units that snaps (default 6). */
  threshold?: number;
}

export interface SnapGuide {
  axis: 'x' | 'y';
  position: number;
  /** The shape aligned with. */
  with: string;
}

/**
 * Adjust a move delta so the moving bounds snap: to other shapes' edges and
 * centers (with guides to draw) first, else to the grid.
 */
export function snapMove(
  doc: CanvasDocument,
  ids: Iterable<string>,
  delta: CanvasXY,
  options: SnapOptions = {}
): { delta: CanvasXY; guides: SnapGuide[] } {
  const roots = selectionRoots(doc, ids);
  if (roots.length === 0) return { delta, guides: [] };
  const moving = new Set(roots.flatMap((entry) => subtreeIds(entry.shape)));
  const start = unionRects(roots.map((entry) => shapeBounds(entry.shape)));
  const box = { ...start, x: start.x + delta.x, y: start.y + delta.y };
  const out = { x: delta.x, y: delta.y };
  let guides: SnapGuide[] = [];
  if (options.objects !== false) {
    const others = walkShapes(doc)
      .filter((entry) => !moving.has(entry.shape.id) && entry.shape.type !== 'group')
      .map((entry) => ({ id: entry.shape.id, rect: shapeBounds(entry.shape) }));
    const snap = snapToGuides(box, others, options.threshold ?? 6);
    out.x += snap.offset.x;
    out.y += snap.offset.y;
    guides = snap.guides.map((guide) => ({ ...guide }));
  }
  const grid = options.grid ?? 0;
  if (grid > 0) {
    if (!guides.some((guide) => guide.axis === 'x'))
      out.x = Math.round((start.x + out.x) / grid) * grid - start.x;
    if (!guides.some((guide) => guide.axis === 'y'))
      out.y = Math.round((start.y + out.y) / grid) * grid - start.y;
  }
  return { delta: out, guides };
}

/** Map a shape (and its children) from one box to another. */
function scaleOps(shape: CanvasShape, from: CanvasRect, to: CanvasRect): CanvasOperation[] {
  const sx = from.width > 0 ? to.width / from.width : 1;
  const sy = from.height > 0 ? to.height / from.height : 1;
  const mapX = (x: number) => to.x + (x - from.x) * sx;
  const mapY = (y: number) => to.y + (y - from.y) * sy;
  const out: CanvasOperation[] = [];
  const stack: CanvasShape[] = [shape];
  while (stack.length > 0) {
    const current = stack.pop() as CanvasShape;
    if (isContainer(current)) stack.push(...current.children);
    if (current.type === 'group') continue;
    const set: CanvasPatch = {
      x: clampCoord(mapX(current.x)),
      y: clampCoord(mapY(current.y)),
      width: Math.min(CANVAS_LIMITS.size, round(current.width * sx)),
      height: Math.min(CANVAS_LIMITS.size, round(current.height * sy)),
    };
    if ('points' in current)
      set.points = current.points.map(([x, y]) => [round(x * sx), round(y * sy)]);
    out.push({ op: 'update', id: current.id, set });
  }
  return out;
}

export interface ResizeOptions {
  /** Keep the width-to-height ratio (corner handles; Shift in the editor). */
  keepAspect?: boolean;
  /** Snap the moving edges to this grid. */
  grid?: number;
  /** Smallest width and height (default 4). */
  min?: number;
}

/**
 * Resize a shape from a handle by a world delta; the opposite edges stay.
 * Rotated shapes resize in their own frame. Lines and paths scale their
 * points; groups scale their children; frames keep their children.
 */
export function resizeOps(
  doc: CanvasDocument,
  id: string,
  handle: ResizeHandle,
  delta: CanvasXY,
  options: ResizeOptions = {}
): CanvasOperation[] {
  const entry = indexShapes(doc).get(id);
  if (!entry || entry.shape.locked) return [];
  const shape = entry.shape;
  const min = options.min ?? 4;
  const start =
    shape.type === 'group'
      ? shapeBounds(shape)
      : {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
        };
  const rotation = shape.type === 'group' ? 0 : (shape.rotation ?? 0);
  const local = rotation ? rotatePoint(delta, { x: 0, y: 0 }, -rotation) : delta;
  let next = resizeRect(start, handle, local, {
    minWidth: min,
    minHeight: min,
    maxWidth: CANVAS_LIMITS.size,
    maxHeight: CANVAS_LIMITS.size,
    keepAspect: options.keepAspect,
    grid: rotation ? undefined : options.grid,
  });
  if (rotation) {
    // Keep the fixed corner where it was on screen: the center moves with the rotation.
    const oldCenter = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
    const newCenterLocal = { x: next.x + next.width / 2, y: next.y + next.height / 2 };
    const shift = rotatePoint(
      { x: newCenterLocal.x - oldCenter.x, y: newCenterLocal.y - oldCenter.y },
      { x: 0, y: 0 },
      rotation
    );
    const center = { x: oldCenter.x + shift.x, y: oldCenter.y + shift.y };
    next = { ...next, x: center.x - next.width / 2, y: center.y - next.height / 2 };
  }
  if (shape.type === 'frame') {
    return [
      {
        op: 'update',
        id,
        set: {
          x: clampCoord(next.x),
          y: clampCoord(next.y),
          width: round(next.width),
          height: round(next.height),
        },
      },
    ];
  }
  return scaleOps(shape, start, next);
}

/** Set a shape's rotation (degrees), optionally snapped to a step. Groups do not rotate. */
export function rotateOps(
  doc: CanvasDocument,
  id: string,
  degrees: number,
  options: { snap?: number } = {}
): CanvasOperation[] {
  const entry = indexShapes(doc).get(id);
  if (!entry || entry.shape.locked || entry.shape.type === 'group' || !Number.isFinite(degrees))
    return [];
  let angle = degrees;
  if (options.snap && options.snap > 0) angle = Math.round(angle / options.snap) * options.snap;
  angle = round(((angle % 360) + 360) % 360);
  if (angle > 180) angle -= 360;
  return [{ op: 'update', id, set: { rotation: angle === 0 ? null : angle } }];
}

/** The rotation that points a shape's top at a world point (a rotate handle drag). */
export function angleTo(shape: CanvasShape, p: CanvasXY): number {
  const b = shapeBounds(shape);
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  return (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Align shapes to the selection bounds (one shape: nothing to align against). */
export function alignOps(
  doc: CanvasDocument,
  ids: Iterable<string>,
  mode: AlignMode
): CanvasOperation[] {
  const roots = selectionRoots(doc, ids).filter((entry) => !entry.shape.locked);
  if (roots.length < 2) return [];
  const bounds = unionRects(roots.map((entry) => shapeBounds(entry.shape)));
  return roots.flatMap((entry) => {
    const b = shapeBounds(entry.shape);
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = bounds.x - b.x;
    else if (mode === 'right') dx = bounds.x + bounds.width - (b.x + b.width);
    else if (mode === 'center') dx = bounds.x + bounds.width / 2 - (b.x + b.width / 2);
    else if (mode === 'top') dy = bounds.y - b.y;
    else if (mode === 'bottom') dy = bounds.y + bounds.height - (b.y + b.height);
    else dy = bounds.y + bounds.height / 2 - (b.y + b.height / 2);
    return dx === 0 && dy === 0 ? [] : translateOps(entry.shape, dx, dy);
  });
}

/** Space three or more shapes with equal gaps along an axis; the outer two stay. */
export function distributeOps(
  doc: CanvasDocument,
  ids: Iterable<string>,
  axis: 'horizontal' | 'vertical'
): CanvasOperation[] {
  const roots = selectionRoots(doc, ids).filter((entry) => !entry.shape.locked);
  if (roots.length < 3) return [];
  const items = roots.map((entry) => ({ entry, box: shapeBounds(entry.shape) }));
  const pos = (box: CanvasRect) => (axis === 'horizontal' ? box.x : box.y);
  const len = (box: CanvasRect) => (axis === 'horizontal' ? box.width : box.height);
  items.sort((a, b) => pos(a.box) - pos(b.box) || (a.entry.shape.id < b.entry.shape.id ? -1 : 1));
  const first = items[0] as (typeof items)[number];
  const last = items[items.length - 1] as (typeof items)[number];
  const span = pos(last.box) + len(last.box) - pos(first.box);
  const used = items.reduce((sum, item) => sum + len(item.box), 0);
  const gap = (span - used) / (items.length - 1);
  let cursor = pos(first.box);
  const out: CanvasOperation[] = [];
  for (const item of items) {
    const delta = cursor - pos(item.box);
    if (Math.abs(delta) > 1e-9)
      out.push(
        ...translateOps(
          item.entry.shape,
          axis === 'horizontal' ? delta : 0,
          axis === 'vertical' ? delta : 0
        )
      );
    cursor += len(item.box) + gap;
  }
  return out;
}

export type ReorderMode = 'front' | 'back' | 'forward' | 'backward';

/** Change z-order within each shape's own list. */
export function reorderOps(
  doc: CanvasDocument,
  ids: Iterable<string>,
  mode: ReorderMode
): CanvasOperation[] {
  const roots = selectionRoots(doc, ids).filter((entry) => !entry.shape.locked);
  const byParent = new Map<string | null, WalkEntry[]>();
  for (const entry of roots) {
    const key = entry.parent?.id ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), entry]);
  }
  const out: CanvasOperation[] = [];
  for (const [parent, entries] of byParent) {
    const list = (entries[0] as WalkEntry).parent?.children ?? doc.shapes;
    const order = list.map((shape) => shape.id);
    const chosen = new Set(entries.map((entry) => entry.shape.id));
    let next: string[];
    if (mode === 'front')
      next = [...order.filter((id) => !chosen.has(id)), ...order.filter((id) => chosen.has(id))];
    else if (mode === 'back')
      next = [...order.filter((id) => chosen.has(id)), ...order.filter((id) => !chosen.has(id))];
    else {
      next = [...order];
      const forward = mode === 'forward';
      const indexes = next.map((_, i) => i).filter((i) => chosen.has(next[i] as string));
      if (forward) indexes.reverse();
      for (const i of indexes) {
        const j = forward ? i + 1 : i - 1;
        if (j < 0 || j >= next.length || chosen.has(next[j] as string)) continue;
        [next[i], next[j]] = [next[j] as string, next[i] as string];
      }
    }
    // Emit moves for the chosen shapes only, in final order.
    for (const [index, id] of next.entries())
      if (chosen.has(id) && order.indexOf(id) !== index) {
        out.push({ op: 'move', id, parent, index });
        order.splice(order.indexOf(id), 1);
        order.splice(index, 0, id);
      }
  }
  return out;
}

/** Remove shapes and connectors (locked shapes stay). */
export function deleteOps(doc: CanvasDocument, ids: Iterable<string>): CanvasOperation[] {
  const list = [...ids];
  const connectorIds = new Set(doc.connectors.map((c) => c.id));
  const removed = new Set<string>();
  const out: CanvasOperation[] = [];
  for (const entry of selectionRoots(doc, list)) {
    if (entry.shape.locked) continue;
    out.push({ op: 'remove', id: entry.shape.id });
    for (const id of subtreeIds(entry.shape)) removed.add(id);
  }
  for (const id of list)
    if (connectorIds.has(id)) {
      const connector = doc.connectors.find((c) => c.id === id) as CanvasConnector;
      const attached = (end: CanvasEndpoint) => 'shape' in end && removed.has(end.shape);
      if (!attached(connector.from) && !attached(connector.to)) out.push({ op: 'remove', id });
    }
  return out;
}

/** An id factory that never repeats an id the canvas (or this factory) used. */
export function createIdFactory(
  doc: Pick<CanvasDocument, 'shapes' | 'connectors'>,
  prefix = 's'
): (kind?: string) => string {
  const used = new Set<string>([
    ...walkShapes(doc).map((entry) => entry.shape.id),
    ...doc.connectors.map((c) => c.id),
  ]);
  let counter = used.size;
  return (kind = prefix) => {
    let id: string;
    do {
      counter += 1;
      id = `${kind}-${counter.toString(36)}`;
    } while (used.has(id));
    used.add(id);
    return id;
  };
}

/** Wrap shapes that share a list into a new group (placed where the top-most one was). */
export function groupOps(
  doc: CanvasDocument,
  ids: Iterable<string>,
  groupId: string
): CanvasOperation[] {
  const roots = selectionRoots(doc, ids).filter((entry) => !entry.shape.locked);
  if (roots.length < 2) return [];
  const parent = (roots[0] as WalkEntry).parent;
  if (roots.some((entry) => entry.parent !== parent)) return [];
  roots.sort((a, b) => a.index - b.index);
  const top = (roots[roots.length - 1] as WalkEntry).index + 1;
  const out: CanvasOperation[] = [
    {
      op: 'add',
      shape: { id: groupId, type: 'group', children: [] },
      parent: parent?.id ?? null,
      index: top,
    },
  ];
  roots.forEach((entry, i) => {
    out.push({ op: 'move', id: entry.shape.id, parent: groupId, index: i });
  });
  return out;
}

/** Put a group's children back in its place (the empty group goes). */
export function ungroupOps(doc: CanvasDocument, groupId: string): CanvasOperation[] {
  const entry = indexShapes(doc).get(groupId);
  if (entry?.shape.type !== 'group' || entry.shape.locked) return [];
  const parent = entry.parent?.id ?? null;
  return entry.shape.children.map((child, i) => ({
    op: 'move' as const,
    id: child.id,
    parent,
    index: entry.index + i,
  }));
}

/** Move shapes into a frame (or to the top level with `null`), on top of its list. */
export function reparentOps(
  doc: CanvasDocument,
  ids: Iterable<string>,
  parent: string | null
): CanvasOperation[] {
  const index = indexShapes(doc);
  const target = parent === null ? null : index.get(parent);
  if (parent !== null && target?.shape.type !== 'frame') return [];
  const length = target
    ? (target.shape as { children: CanvasShape[] }).children.length
    : doc.shapes.length;
  let at = length;
  const out: CanvasOperation[] = [];
  for (const entry of selectionRoots(doc, ids)) {
    if (entry.shape.locked || (entry.parent?.id ?? null) === parent) continue;
    if (parent !== null && subtreeIds(entry.shape).includes(parent)) continue;
    out.push({ op: 'move', id: entry.shape.id, parent, index: at });
    at += 1;
  }
  return out;
}

/** The top-most frame whose box holds a rect (dropping shapes into frames). */
export function frameAt(
  doc: CanvasDocument,
  rect: CanvasRect,
  exclude: Iterable<string> = []
): string | null {
  const skip = new Set(exclude);
  let found: string | null = null;
  for (const entry of walkShapes(doc)) {
    const shape = entry.shape;
    if (shape.type !== 'frame' || skip.has(shape.id)) continue;
    if (
      rect.x >= shape.x &&
      rect.y >= shape.y &&
      rect.x + rect.width <= shape.x + shape.width &&
      rect.y + rect.height <= shape.y + shape.height
    )
      found = shape.id;
  }
  return found;
}

/** Set a shape's text (a frame's title) or a connector's label; empty clears optional text. */
export function textOps(doc: CanvasDocument, id: string, text: string): CanvasOperation[] {
  const entry = indexShapes(doc).get(id);
  if (entry) {
    const shape = entry.shape;
    if (shape.locked) return [];
    if (shape.type === 'frame')
      return [{ op: 'update', id, set: { title: text === '' ? null : text } }];
    if (shape.type === 'image') return [{ op: 'update', id, set: { alt: text } }];
    if (shape.type === 'text' || shape.type === 'sticky')
      return [{ op: 'update', id, set: { text } }];
    if (shape.type === 'rect' || shape.type === 'ellipse' || shape.type === 'diamond')
      return [{ op: 'update', id, set: { text: text === '' ? null : text } }];
    return [];
  }
  if (doc.connectors.some((c) => c.id === id))
    return [{ op: 'update', id, set: { text: text === '' ? null : text } }];
  return [];
}

/** Connect two shapes (or points). */
export function connectOps(
  from: CanvasEndpoint,
  to: CanvasEndpoint,
  id: string,
  options: { routing?: CanvasRouting } = {}
): CanvasOperation[] {
  return [
    {
      op: 'connect',
      connector: { id, from, to, ...(options.routing ? { routing: options.routing } : {}) },
    },
  ];
}

// ---------------------------------------------------------------------------
// Clipboard

export const CLIPBOARD_FORMAT = 'texuli-canvas-clipboard' as const;

/** What copy writes: the shapes and the connectors between them, as JSON. */
export interface CanvasClipboard {
  format: typeof CLIPBOARD_FORMAT;
  version: 1;
  shapes: CanvasShape[];
  connectors: CanvasConnector[];
}

/** Copy shapes (with their children) and the connectors whose both ends were copied. */
export function copyShapes(doc: CanvasDocument, ids: Iterable<string>): CanvasClipboard {
  const roots = selectionRoots(doc, ids);
  const shapes = JSON.parse(JSON.stringify(roots.map((entry) => entry.shape))) as CanvasShape[];
  const copied = new Set(roots.flatMap((entry) => subtreeIds(entry.shape)));
  const connectors = doc.connectors.filter(
    (c) =>
      (!('shape' in c.from) || copied.has(c.from.shape)) &&
      (!('shape' in c.to) || copied.has(c.to.shape)) &&
      ('shape' in c.from || 'shape' in c.to)
  );
  return {
    format: CLIPBOARD_FORMAT,
    version: 1,
    shapes,
    connectors: JSON.parse(JSON.stringify(connectors)) as CanvasConnector[],
  };
}

export function serializeClipboard(clip: CanvasClipboard): string {
  return JSON.stringify(clip);
}

/**
 * Read a clipboard from text (untrusted: another app, another user): size
 * checked before parsing, then validated as a canvas at the tier.
 */
export function parseClipboard(
  text: string,
  options: { trust?: HrefTrust } = {}
): { ok: true; clip: CanvasClipboard } | { ok: false; issues: CanvasValidation['issues'] } {
  if (typeof text !== 'string' || text.length > CANVAS_LIMITS.bytes)
    return { ok: false, issues: [] };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, issues: [] };
  }
  const raw = value as Partial<CanvasClipboard> | null;
  if (!raw || typeof raw !== 'object' || raw.format !== CLIPBOARD_FORMAT || raw.version !== 1)
    return { ok: false, issues: [] };
  const checked = validateCanvas(
    { format: 'texuli-canvas', formatVersion: 1, shapes: raw.shapes, connectors: raw.connectors },
    { trust: options.trust }
  );
  if (!checked.ok) return { ok: false, issues: checked.issues };
  return {
    ok: true,
    clip: {
      format: CLIPBOARD_FORMAT,
      version: 1,
      shapes: checked.canvas.shapes,
      connectors: checked.canvas.connectors,
    },
  };
}

/** Paste a clipboard: fresh ids for everything, offset by `offset`, on top of `parent`'s list. */
export function pasteOps(
  doc: CanvasDocument,
  clip: CanvasClipboard,
  options: { offset?: CanvasXY; parent?: string | null; nextId?: (kind?: string) => string } = {}
): { ops: CanvasOperation[]; ids: string[] } {
  const nextId = options.nextId ?? createIdFactory(doc);
  const dx = options.offset?.x ?? 0;
  const dy = options.offset?.y ?? 0;
  const map = new Map<string, string>();
  const shapes = JSON.parse(JSON.stringify(clip.shapes)) as CanvasShape[];
  const stack: CanvasShape[] = [...shapes];
  while (stack.length > 0) {
    const shape = stack.pop() as CanvasShape & { id: string };
    const fresh = nextId(shape.type === 'group' ? 'g' : 's');
    map.set(shape.id, fresh);
    shape.id = fresh;
    if (shape.type !== 'group') {
      shape.x = clampCoord(shape.x + dx);
      shape.y = clampCoord(shape.y + dy);
    }
    if (isContainer(shape)) stack.push(...shape.children);
  }
  const index = indexShapes(doc);
  const parent = options.parent ?? null;
  const parentLength =
    parent === null
      ? doc.shapes.length
      : ((index.get(parent)?.shape as { children?: CanvasShape[] } | undefined)?.children?.length ??
        0);
  const ops: CanvasOperation[] = shapes.map((shape, i) => ({
    op: 'add' as const,
    shape,
    parent,
    index: parentLength + i,
  }));
  const end = (e: CanvasEndpoint): CanvasEndpoint =>
    'shape' in e
      ? { ...e, shape: map.get(e.shape) ?? e.shape }
      : { x: clampCoord(e.x + dx), y: clampCoord(e.y + dy) };
  for (const connector of clip.connectors)
    ops.push({
      op: 'connect',
      connector: {
        ...connector,
        id: nextId('c'),
        from: end(connector.from),
        to: end(connector.to),
      },
    });
  return { ops, ids: shapes.map((shape) => shape.id) };
}

/** Copy and paste in one step, offset by `offset` (default 16, 16). */
export function duplicateOps(
  doc: CanvasDocument,
  ids: Iterable<string>,
  offset: CanvasXY = { x: 16, y: 16 }
): { ops: CanvasOperation[]; ids: string[] } {
  return pasteOps(doc, copyShapes(doc, ids), { offset });
}
