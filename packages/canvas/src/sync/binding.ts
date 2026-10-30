/**
 * The canvas on the `@texuli/document/sync` CRDT (ADR-010):
 *
 * - **Tree:** every shape is a node (id = shape id, type = shape type) under
 *   the root or its frame or group, so moving into a frame, grouping and
 *   z-order (sibling order is a sequence) merge with the move-safe tree.
 * - **Registers:** geometry, style and every other field are last-writer-wins
 *   properties. A line's or path's points are one bounded register
 *   (`CANVAS_LIMITS.pathPoints`), so concurrent redraws keep one whole stroke.
 * - **Sequences:** shape text, frame titles and connector labels are text
 *   fields, so concurrent typing merges.
 * - Connectors are nodes under the `tx:connectors` container; canvas
 *   metadata and the grid are root properties.
 *
 * `projectCanvas` reads the replica back into a canvas that always passes
 * the validator: invalid remote values drop the shape or connector they sit
 * on, deterministically, so every converged replica projects the same
 * canvas. `commitCanvas` writes a next canvas as an id-keyed diff.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import { type Replica, ROOT, type SyncJson } from '@texuli/document/sync';
import { createCanvas, isContainer, walkShapes } from '../model/document.ts';
import { CANVAS_LIMITS, SHAPE_TYPES } from '../model/limits.ts';
import { validateCanvas } from '../model/schema.ts';
import type {
  CanvasConnector,
  CanvasDocument,
  CanvasMeta,
  CanvasShape,
  ContainerShape,
} from '../model/types.ts';

/** The container node that holds connectors. */
export const CONNECTORS_NODE = 'tx:connectors';
/** The node types a canvas replica accepts (a closed set: other creates are dropped). */
export const CANVAS_NODE_TYPES: readonly string[] = Object.freeze([
  ...SHAPE_TYPES,
  'connector',
  'connectors',
]);

const TEXT_FIELD = 'text';
const META_KEYS = ['title', 'locale', 'description', 'grid'] as const;
const STRUCTURAL = new Set(['id', 'type', 'children']);

/** Which field of a shape or connector lives in the text sequence. */
function textKey(type: string): 'text' | 'title' | null {
  if (type === 'frame') return 'title';
  if (
    type === 'rect' ||
    type === 'ellipse' ||
    type === 'diamond' ||
    type === 'text' ||
    type === 'sticky' ||
    type === 'connector'
  )
    return 'text';
  return null;
}

const requiredText = (type: string) => type === 'text' || type === 'sticky';

function readNode(
  replica: Replica,
  id: string
): { type: string; props: Record<string, unknown>; text: string | null } | null {
  const node = replica.node(id);
  if (!node) return null;
  const key = textKey(node.type);
  return { type: node.type, props: node.props, text: key ? replica.text(id, TEXT_FIELD) : null };
}

function buildItem(id: string, type: string, props: Record<string, unknown>, text: string | null) {
  const out: Record<string, unknown> = { id, type };
  for (const key of Object.keys(props).sort())
    if (!STRUCTURAL.has(key) && key !== 'text' && key !== 'title') out[key] = props[key];
  const key = textKey(type);
  if (key && text !== null && (text !== '' || requiredText(type))) out[key] = text;
  return out;
}

/** Read the replica as a candidate canvas (unvalidated). Iterative. */
function readCandidate(replica: Replica): CanvasDocument {
  const doc = createCanvas();
  const root = replica.node(ROOT);
  const meta: Record<string, unknown> = {};
  for (const key of META_KEYS) {
    const value = root?.props[key];
    if (value === undefined) continue;
    if (key === 'grid') doc.grid = value as number;
    else meta[key] = value;
  }
  if (Object.keys(meta).length > 0) doc.meta = meta as CanvasMeta;
  const types = new Set<string>(SHAPE_TYPES);
  const stack: { parent: string; list: CanvasShape[]; depth: number }[] = [
    { parent: ROOT, list: doc.shapes, depth: 0 },
  ];
  let count = 0;
  while (stack.length > 0) {
    const { parent, list, depth } = stack.pop() as (typeof stack)[number];
    for (const id of replica.children(parent)) {
      const node = readNode(replica, id);
      if (!node || !types.has(node.type)) continue;
      if (++count > CANVAS_LIMITS.shapes * 2) return doc;
      const shape = buildItem(id, node.type, node.props, node.text) as unknown as CanvasShape;
      if (node.type === 'frame' || node.type === 'group') {
        const children: CanvasShape[] = [];
        (shape as ContainerShape).children = children;
        if (depth < CANVAS_LIMITS.depth)
          stack.push({ parent: id, list: children, depth: depth + 1 });
      }
      list.push(shape);
    }
  }
  for (const id of replica.children(CONNECTORS_NODE)) {
    const node = readNode(replica, id);
    if (node?.type !== 'connector') continue;
    if (doc.connectors.length >= CANVAS_LIMITS.connectors * 2) break;
    const connector = buildItem(id, 'connector', node.props, node.text);
    delete connector.type;
    doc.connectors.push(connector as unknown as CanvasConnector);
  }
  return doc;
}

/** Drop what the issues point at: the deepest shape or the connector on each path. */
function repair(
  doc: CanvasDocument,
  issues: { code: string; path: readonly (string | number)[] }[]
) {
  const dropShapes = new Set<CanvasShape>();
  const dropConnectors = new Set<number>();
  let trimTotals = false;
  for (const issue of issues) {
    const path = issue.path;
    if (path[0] === 'connectors' && typeof path[1] === 'number') dropConnectors.add(path[1]);
    else if (path[0] === 'meta' || path[0] === 'grid') {
      if (path[0] === 'meta') delete doc.meta;
      else delete doc.grid;
    } else if (path[0] === 'shapes' && typeof path[1] === 'number') {
      let list = doc.shapes;
      let target: CanvasShape | undefined;
      for (let i = 1; i < path.length; i += 2) {
        const index = path[i];
        if (typeof index !== 'number') break;
        target = list[index];
        if (!target || path[i + 1] !== 'children' || !isContainer(target)) break;
        list = target.children;
      }
      if (target) dropShapes.add(target);
    } else trimTotals = true;
  }
  if (trimTotals) {
    // Whole-canvas totals: keep shapes in walk order while they fit.
    const entries = walkShapes(doc);
    let shapes = 0;
    let points = 0;
    let text = 0;
    for (const { shape } of entries) {
      shapes += 1;
      if ('points' in shape && Array.isArray(shape.points)) points += shape.points.length;
      if ('text' in shape && typeof shape.text === 'string') text += shape.text.length;
      if (
        shapes > CANVAS_LIMITS.shapes ||
        points > CANVAS_LIMITS.totalPoints ||
        text > CANVAS_LIMITS.totalText / 2
      )
        dropShapes.add(shape);
    }
    if (doc.connectors.length > CANVAS_LIMITS.connectors)
      doc.connectors.length = CANVAS_LIMITS.connectors;
  }
  const prune = (list: CanvasShape[]): CanvasShape[] => {
    const kept = list.filter((shape) => !dropShapes.has(shape));
    for (const shape of kept) if (isContainer(shape)) shape.children = prune(shape.children);
    return kept.filter((shape) => shape.type !== 'group' || shape.children.length > 0);
  };
  doc.shapes = prune(doc.shapes);
  doc.connectors = doc.connectors.filter((_, i) => !dropConnectors.has(i));
}

/**
 * Project a replica into a valid canvas at the tier. Linear in the replica
 * when it is valid; each repair round drops at least one item.
 */
export function projectCanvas(
  replica: Replica,
  options: { trust?: HrefTrust } = {}
): CanvasDocument {
  const doc = readCandidate(replica);
  for (let round = 0; round < 64; round += 1) {
    // Many issues per round, so a hostile state is repaired in a few linear passes.
    const checked = validateCanvas(doc, { trust: options.trust, maxIssues: 2_000 });
    if (checked.ok) return checked.canvas;
    repair(doc, checked.issues);
  }
  return createCanvas();
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function setProps(replica: Replica, id: string, desired: Record<string, unknown>): void {
  const current = replica.node(id)?.props ?? {};
  for (const [key, value] of Object.entries(desired))
    if (!same(current[key], value)) replica.setProp(id, key, value as SyncJson);
  for (const key of Object.keys(current)) if (!(key in desired)) replica.setProp(id, key, null);
}

/** Change a text field with one insert and one delete around the common prefix and suffix (code points). */
function setText(replica: Replica, id: string, next: string): void {
  const before = Array.from(replica.text(id, TEXT_FIELD));
  const after = Array.from(next);
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start])
    start += 1;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end += 1;
  const removed = before.length - start - end;
  if (removed > 0) replica.deleteText(id, TEXT_FIELD, start, removed);
  const inserted = after.slice(start, after.length - end).join('');
  if (inserted) replica.insertText(id, TEXT_FIELD, start, inserted);
}

function fieldsOf(item: Record<string, unknown>): {
  props: Record<string, unknown>;
  text: string | null;
} {
  const type = typeof item.type === 'string' ? item.type : 'connector';
  const key = textKey(type);
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(item))
    if (!STRUCTURAL.has(name) && name !== key && value !== undefined) props[name] = value;
  const text = key ? (typeof item[key] === 'string' ? (item[key] as string) : '') : null;
  return { props, text };
}

/** Place `ids` in order under `parent`, creating, reviving or moving nodes; remove leftovers not kept elsewhere. */
function placeChildren(
  replica: Replica,
  parent: string,
  items: { id: string; type: string; item: Record<string, unknown> }[],
  keep: ReadonlySet<string>
): void {
  // The parent's children as they change, so each step is a lookup, not a fresh read.
  const current = replica.children(parent);
  for (const [index, { id, type, item }] of items.entries()) {
    const node = replica.node(id);
    if (!node) {
      const { props, text } = fieldsOf(item);
      replica.insertNode(type, parent, index, { id, props: props as Record<string, SyncJson> });
      if (text) replica.insertText(id, TEXT_FIELD, 0, text);
      current.splice(index, 0, id);
      continue;
    }
    if (node.type !== type) replica.setNodeType(id, type);
    if (current[index] !== id) {
      replica.moveNode(id, parent, index);
      const at = current.indexOf(id);
      if (at >= 0) current.splice(at, 1);
      current.splice(index, 0, id);
    }
  }
  const wanted = new Set(items.map((entry) => entry.id));
  for (const id of current) if (!wanted.has(id) && !keep.has(id)) replica.removeNode(id);
}

/**
 * Write `next` into the replica as the edits that turn the current state
 * into it (one transaction: one undo step and one batch). `next` must be a
 * valid canvas.
 */
export function commitCanvas(replica: Replica, next: CanvasDocument): void {
  replica.transact(() => {
    const root = replica.node(ROOT)?.props ?? {};
    const meta: Record<string, unknown> = { ...(next.meta ?? {}) };
    if (next.grid !== undefined) meta.grid = next.grid;
    for (const key of META_KEYS)
      if (!same(root[key], meta[key])) replica.setProp(ROOT, key, (meta[key] ?? null) as SyncJson);

    const entries = walkShapes(next);
    const keep = new Set(entries.map((entry) => entry.shape.id));
    const lists: { parent: string; shapes: CanvasShape[] }[] = [
      { parent: ROOT, shapes: next.shapes },
    ];
    for (let i = 0; i < lists.length; i += 1) {
      const { parent, shapes } = lists[i] as (typeof lists)[number];
      placeChildren(
        replica,
        parent,
        shapes.map((shape) => ({
          id: shape.id,
          type: shape.type,
          item: shape as unknown as Record<string, unknown>,
        })),
        keep
      );
      for (const shape of shapes)
        if (isContainer(shape)) lists.push({ parent: shape.id, shapes: shape.children });
    }
    for (const { shape } of entries) {
      const { props, text } = fieldsOf(shape as unknown as Record<string, unknown>);
      setProps(replica, shape.id, props);
      if (text !== null && replica.text(shape.id, TEXT_FIELD) !== text)
        setText(replica, shape.id, text);
    }

    replica.ensureNode(CONNECTORS_NODE, 'connectors');
    placeChildren(
      replica,
      CONNECTORS_NODE,
      next.connectors.map((connector) => ({
        id: connector.id,
        type: 'connector',
        item: { ...connector } as unknown as Record<string, unknown>,
      })),
      new Set()
    );
    for (const connector of next.connectors) {
      const { props, text } = fieldsOf({ ...connector, type: 'connector' } as unknown as Record<
        string,
        unknown
      >);
      delete props.type;
      setProps(replica, connector.id, props);
      if (text !== null && replica.text(connector.id, TEXT_FIELD) !== text)
        setText(replica, connector.id, text);
    }
  });
}
