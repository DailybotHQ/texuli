/**
 * Reading a canvas: walks, an id index, shape bounds (rotation included),
 * hit testing and the reading order the editor tabs through. Iterative and
 * linear in the canvas.
 */
import { CANVAS_FORMAT, CANVAS_FORMAT_VERSION } from './limits.ts';
import type {
  BoxedShape,
  CanvasDocument,
  CanvasRect,
  CanvasShape,
  CanvasXY,
  ContainerShape,
} from './types.ts';

/** A new, empty canvas. */
export function createCanvas(meta: CanvasDocument['meta'] = undefined): CanvasDocument {
  return {
    format: CANVAS_FORMAT,
    formatVersion: CANVAS_FORMAT_VERSION,
    ...(meta ? { meta } : {}),
    shapes: [],
    connectors: [],
  };
}

export interface WalkEntry {
  shape: CanvasShape;
  /** The frame or group that holds it, or `null` at the top level. */
  parent: ContainerShape | null;
  /** Its index in the parent's list (z-order). */
  index: number;
  depth: number;
}

/** Every shape, parents before children, each list bottom to top. Iterative. */
export function walkShapes(doc: Pick<CanvasDocument, 'shapes'>): WalkEntry[] {
  const out: WalkEntry[] = [];
  const stack: { list: CanvasShape[]; parent: ContainerShape | null; depth: number }[] = [
    { list: doc.shapes, parent: null, depth: 0 },
  ];
  while (stack.length > 0) {
    const { list, parent, depth } = stack.pop() as (typeof stack)[number];
    const children: (typeof stack)[number][] = [];
    for (let index = 0; index < list.length; index += 1) {
      const shape = list[index] as CanvasShape;
      out.push({ shape, parent, index, depth });
      if (isContainer(shape))
        children.push({ list: shape.children, parent: shape, depth: depth + 1 });
    }
    for (let i = children.length - 1; i >= 0; i -= 1)
      stack.push(children[i] as (typeof stack)[number]);
  }
  return out;
}

export function isContainer(shape: CanvasShape): shape is ContainerShape {
  return shape.type === 'frame' || shape.type === 'group';
}

/** An id → entry index of every shape. */
export function indexShapes(doc: Pick<CanvasDocument, 'shapes'>): Map<string, WalkEntry> {
  const map = new Map<string, WalkEntry>();
  for (const entry of walkShapes(doc)) map.set(entry.shape.id, entry);
  return map;
}

/** The list that holds `id` (the top-level list or a container's children). */
export function siblingsOf(doc: CanvasDocument, entry: WalkEntry): CanvasShape[] {
  return entry.parent ? entry.parent.children : doc.shapes;
}

/** A shape and every shape inside it. */
export function subtreeIds(shape: CanvasShape): string[] {
  const out: string[] = [];
  const stack: CanvasShape[] = [shape];
  while (stack.length > 0) {
    const current = stack.pop() as CanvasShape;
    out.push(current.id);
    if (isContainer(current)) for (const child of current.children) stack.push(child);
  }
  return out;
}

const EMPTY: CanvasRect = Object.freeze({ x: 0, y: 0, width: 0, height: 0 }) as CanvasRect;

/** The smallest rect holding every rect (an empty rect at 0,0 for none). */
export function unionRects(rects: Iterable<CanvasRect>): CanvasRect {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  if (minX === Number.POSITIVE_INFINITY) return { ...EMPTY };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** A boxed shape's unrotated box. */
export function boxOf(shape: BoxedShape): CanvasRect {
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}

/** Rotate `p` by `degrees` around `center`. */
export function rotatePoint(p: CanvasXY, center: CanvasXY, degrees: number): CanvasXY {
  if (!degrees) return { x: p.x, y: p.y };
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

/** The axis-aligned bounds of a shape, rotation included; a group's are its children's. */
export function shapeBounds(shape: CanvasShape): CanvasRect {
  if (shape.type === 'group') {
    const rects: CanvasRect[] = [];
    const stack: CanvasShape[] = [...shape.children];
    while (stack.length > 0) {
      const current = stack.pop() as CanvasShape;
      if (current.type === 'group') stack.push(...current.children);
      else rects.push(shapeBounds(current));
    }
    return unionRects(rects);
  }
  const box = boxOf(shape);
  if (!shape.rotation) return box;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ].map((corner) => rotatePoint(corner, center, shape.rotation ?? 0));
  return unionRects(corners.map((c) => ({ x: c.x, y: c.y, width: 0, height: 0 })));
}

/** Bounds of the given shapes (or of everything). */
export function canvasBounds(doc: CanvasDocument, ids?: Iterable<string>): CanvasRect {
  if (!ids) return unionRects(doc.shapes.map(shapeBounds));
  const index = indexShapes(doc);
  const rects: CanvasRect[] = [];
  for (const id of ids) {
    const entry = index.get(id);
    if (entry) rects.push(shapeBounds(entry.shape));
  }
  return unionRects(rects);
}

function distanceToSegment(p: CanvasXY, a: CanvasXY, b: CanvasXY): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const length = vx * vx + vy * vy;
  const t =
    length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / length));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/** Whether a world point hits a shape (rotation included; lines within `tolerance`). */
export function hitShape(shape: CanvasShape, p: CanvasXY, tolerance = 4): boolean {
  if (shape.type === 'group') return shape.children.some((child) => hitShape(child, p, tolerance));
  const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
  const local = shape.rotation ? rotatePoint(p, center, -shape.rotation) : p;
  if (shape.type === 'line' || shape.type === 'arrow' || (shape.type === 'path' && !shape.closed)) {
    const pts = shape.points;
    if (pts.length === 1) {
      const only = pts[0] as [number, number];
      return Math.hypot(local.x - shape.x - only[0], local.y - shape.y - only[1]) <= tolerance;
    }
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1] as [number, number];
      const b = pts[i] as [number, number];
      if (
        distanceToSegment(
          local,
          { x: shape.x + a[0], y: shape.y + a[1] },
          { x: shape.x + b[0], y: shape.y + b[1] }
        ) <= tolerance
      )
        return true;
    }
    return false;
  }
  const inside =
    local.x >= shape.x - tolerance &&
    local.x <= shape.x + shape.width + tolerance &&
    local.y >= shape.y - tolerance &&
    local.y <= shape.y + shape.height + tolerance;
  if (!inside) return false;
  if (shape.type === 'ellipse') {
    const rx = shape.width / 2 + tolerance;
    const ry = shape.height / 2 + tolerance;
    if (rx <= 0 || ry <= 0) return false;
    return ((local.x - center.x) / rx) ** 2 + ((local.y - center.y) / ry) ** 2 <= 1;
  }
  if (shape.type === 'diamond') {
    const rx = shape.width / 2 + tolerance;
    const ry = shape.height / 2 + tolerance;
    if (rx <= 0 || ry <= 0) return false;
    return Math.abs(local.x - center.x) / rx + Math.abs(local.y - center.y) / ry <= 1;
  }
  return true;
}

/**
 * The top-most shape under a world point: top-level shapes and the contents
 * of groups resolve to the outermost group; frames resolve to the child hit
 * inside them, else the frame. Returns its id or `null`.
 */
export function shapeAt(doc: CanvasDocument, p: CanvasXY, tolerance = 4): string | null {
  let list = doc.shapes;
  let found: string | null = null;
  for (;;) {
    let hit: CanvasShape | null = null;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const shape = list[i] as CanvasShape;
      if (hitShape(shape, p, tolerance)) {
        hit = shape;
        break;
      }
    }
    if (!hit) return found;
    found = hit.id;
    if (hit.type !== 'frame') return found;
    list = hit.children;
  }
}

/** Ids of shapes (top level and frame children, not group members) whose bounds a world rect touches or contains. */
export function shapesInRect(
  doc: CanvasDocument,
  rect: CanvasRect,
  mode: 'intersect' | 'contain' = 'intersect'
): string[] {
  const out: string[] = [];
  const stack: CanvasShape[] = [...doc.shapes];
  while (stack.length > 0) {
    const shape = stack.pop() as CanvasShape;
    const b = shapeBounds(shape);
    const touches =
      mode === 'contain'
        ? b.x >= rect.x &&
          b.y >= rect.y &&
          b.x + b.width <= rect.x + rect.width &&
          b.y + b.height <= rect.y + rect.height
        : b.x <= rect.x + rect.width &&
          b.x + b.width >= rect.x &&
          b.y <= rect.y + rect.height &&
          b.y + b.height >= rect.y;
    if (touches) out.push(shape.id);
    if (shape.type === 'frame') stack.push(...shape.children);
  }
  return out.sort();
}

/**
 * The reading order the editor tabs through and the shape list announces:
 * at each level, shapes sorted top to bottom in rows (a shape starts a new
 * row when its top is below the middle of every shape in the row), then by their
 * start edge in reading direction; a container's children follow it. Linear
 * after one sort per level.
 */
export function readingOrder(
  doc: Pick<CanvasDocument, 'shapes'>,
  dir: 'ltr' | 'rtl' = 'ltr'
): string[] {
  const out: string[] = [];
  const order = (list: CanvasShape[]): CanvasShape[] => {
    const boxes = list.map((shape) => ({ shape, box: shapeBounds(shape) }));
    boxes.sort(
      (a, b) => a.box.y - b.box.y || a.box.x - b.box.x || (a.shape.id < b.shape.id ? -1 : 1)
    );
    const rows: (typeof boxes)[] = [];
    let rowEnd = Number.NEGATIVE_INFINITY;
    for (const item of boxes) {
      const middle = item.box.y + item.box.height / 2;
      if (rows.length === 0 || item.box.y > rowEnd) {
        rows.push([item]);
        rowEnd = middle;
      } else {
        (rows[rows.length - 1] as typeof boxes).push(item);
        rowEnd = Math.min(rowEnd, middle);
      }
    }
    const sorted: CanvasShape[] = [];
    for (const row of rows) {
      row.sort((a, b) =>
        dir === 'rtl'
          ? b.box.x + b.box.width - (a.box.x + a.box.width) || (a.shape.id < b.shape.id ? -1 : 1)
          : a.box.x - b.box.x || (a.shape.id < b.shape.id ? -1 : 1)
      );
      for (const item of row) sorted.push(item.shape);
    }
    return sorted;
  };
  const stack: CanvasShape[][] = [order(doc.shapes).reverse()];
  while (stack.length > 0) {
    const list = stack[stack.length - 1] as CanvasShape[];
    const shape = list.pop();
    if (!shape) {
      stack.pop();
      continue;
    }
    out.push(shape.id);
    if (isContainer(shape) && shape.children.length > 0)
      stack.push(order(shape.children).reverse());
  }
  return out;
}

/** A readable name for a shape: its text, title or alt, else its kind. */
export function shapeName(shape: CanvasShape): string {
  const text =
    shape.type === 'frame'
      ? shape.title
      : shape.type === 'image'
        ? shape.alt
        : 'text' in shape
          ? shape.text
          : undefined;
  const line = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  if (line.length <= 80) return line;
  return `${Array.from(line).slice(0, 79).join('')}…`;
}
