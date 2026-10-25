/**
 * Framework-free outline group operations: multi-select, group moves and
 * removal, duplicate, and copy and paste of subtrees. Like `model.ts`, it
 * turns intents into plain `@texuli/catalog/edit` ops and never mutates a
 * tree; the host applies the ops through its labeled history and checks
 * them with the same structure guard as single moves (`guard.ts`).
 *
 * Group ops run in sequence, each addressed against the tree the previous
 * one produced, so a batch applies as one undo step.
 */
import { applyEditOp, canonicalBlueprintJson, type EditOp } from '@texuli/catalog/edit';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import {
  type CanContain,
  type DropPosition,
  keyboardMove,
  type MoveIntent,
  type MoveOp,
  type MoveRefusal,
  type MoveResult,
  type NodePath,
  nodeAt,
  pathAfterRemoval,
  pathKey,
} from './model.ts';

export type InsertOp = Extract<EditOp, { op: 'insert' }>;
export type RemoveOp = Extract<EditOp, { op: 'remove' }>;

export type GroupRefusal = MoveRefusal | 'empty-clipboard';

/** Group ops and where the group's nodes sit once they are applied, in reading order. */
export type GroupResult<Op extends EditOp> =
  | { ok: true; ops: Op[]; paths: number[][] }
  | { ok: false; reason: GroupRefusal };

export const GROUP_REFUSAL_TEXT: Readonly<Record<GroupRefusal, string>> = Object.freeze({
  root: 'The page root cannot move.',
  first: 'One of the selected components is already first in its group.',
  last: 'One of the selected components is already last in its group.',
  'no-container': 'That component cannot hold other components.',
  'top-level': 'One of the selected components is already at the top level of the page.',
  'into-itself': 'A component cannot move into itself.',
  'same-place': 'That is where they already are.',
  missing: 'That row no longer exists.',
  'empty-clipboard': 'Nothing is copied yet. Copy a component first.',
});

// ── Paths ────────────────────────────────────────────────────────────────

function isPrefix(prefix: NodePath, path: NodePath): boolean {
  return prefix.length <= path.length && prefix.every((value, index) => path[index] === value);
}

/** Reading order: a parent before its children, earlier siblings first. */
export function comparePaths(left: NodePath, right: NodePath): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function parseKey(key: string): number[] {
  return key === '' ? [] : key.split('.').map(Number);
}

/**
 * The nodes a group op acts on: unique, in reading order, never the root,
 * and never a node whose ancestor is also selected (the ancestor carries it).
 */
export function groupRoots(paths: readonly NodePath[]): number[][] {
  const sorted = [...new Map(paths.map((path) => [pathKey(path), [...path]])).values()].sort(
    comparePaths
  );
  const roots: number[][] = [];
  for (const path of sorted) {
    if (path.length === 0) continue;
    if (roots.some((root) => isPrefix(root, path))) continue;
    roots.push(path);
  }
  return roots;
}

/** Where `path` sits after a child is inserted at `index` of `parent`. */
function pathAfterInsert(parent: NodePath, index: number, path: NodePath): number[] {
  const next = [...path];
  const level = parent.length;
  const at = next[level];
  if (path.length > level && isPrefix(parent, path) && at !== undefined && at >= index) {
    next[level] = at + 1;
  }
  return next;
}

/**
 * Where the node at `path` sits after `op` (`null`: it was removed). A
 * moved node carries its subtree; other ops leave paths as they are.
 */
export function pathAfterOp(op: EditOp, path: NodePath): number[] | null {
  switch (op.op) {
    case 'insert':
      return pathAfterInsert(op.parent, op.index, path);
    case 'remove':
      return pathAfterRemoval(op.path, path);
    case 'move': {
      if (isPrefix(op.path, path)) return [...op.parent, op.index, ...path.slice(op.path.length)];
      const removed = pathAfterRemoval(op.path, path);
      return removed && pathAfterInsert(op.parent, op.index, removed);
    }
    default:
      return [...path];
  }
}

/**
 * Where each inserted or moved node ends up once the whole batch has run:
 * the node every insert or move op placed, followed through the later ops.
 * The selection follows these after a group op, an undo or a redo.
 */
export function placedPaths(ops: readonly EditOp[]): number[][] {
  const placed: number[][] = [];
  ops.forEach((op, index) => {
    if (op.op !== 'insert' && op.op !== 'move') return;
    let path: number[] | null = [...op.parent, op.index];
    for (const later of ops.slice(index + 1)) {
      if (!path) break;
      path = pathAfterOp(later, path);
    }
    if (path) placed.push(path);
  });
  return placed.sort(comparePaths);
}

// ── Multi-select ─────────────────────────────────────────────────────────

/** Ctrl/Cmd+click or Space: add a row to the selection, or take it out. */
export function toggleKey(selection: readonly string[], key: string): string[] {
  return selection.includes(key)
    ? selection.filter((candidate) => candidate !== key)
    : [...selection, key];
}

/** Shift+click, Shift+Space or Shift+Arrow: every row from the anchor to `key`, in reading order. */
export function rangeKeys(rowKeys: readonly string[], anchor: string, key: string): string[] {
  const from = rowKeys.indexOf(anchor);
  const to = rowKeys.indexOf(key);
  if (to < 0) return [];
  if (from < 0) return [key];
  return rowKeys.slice(Math.min(from, to), Math.max(from, to) + 1);
}

// ── Group moves ──────────────────────────────────────────────────────────

/** Run `step` for each root in `order`, readdressing the others after every op. */
function sequence(
  tree: CatalogTreeInput,
  roots: number[][],
  order: 'forward' | 'backward',
  step: (current: CatalogTreeInput, path: number[]) => MoveResult
): GroupResult<MoveOp> {
  if (roots.length === 0) return { ok: false, reason: 'root' };
  let positions = order === 'forward' ? roots : [...roots].reverse();
  let current = tree;
  const ops: MoveOp[] = [];
  for (let index = 0; index < positions.length; index += 1) {
    const path = positions[index];
    if (!path) return { ok: false, reason: 'missing' };
    const result = step(current, path);
    if (!result.ok) return result;
    const applied = applyEditOp(current, result.op);
    if (!applied.ok) return { ok: false, reason: 'missing' };
    current = applied.tree;
    const op = result.op;
    positions = positions.map((other, at) =>
      at === index ? [...op.parent, op.index] : (pathAfterOp(op, other) ?? other)
    );
    ops.push(op);
  }
  if (canonicalBlueprintJson(current) === canonicalBlueprintJson(tree)) {
    return { ok: false, reason: 'same-place' };
  }
  return { ok: true, ops, paths: [...positions].sort(comparePaths) };
}

/**
 * Alt+Arrow on a selection: every selected node takes the same single move,
 * and the group keeps its order. All or nothing: when one node cannot move
 * (already first, no container above), none does.
 */
export function groupKeyboardMove(
  tree: CatalogTreeInput,
  paths: readonly NodePath[],
  intent: MoveIntent,
  canContain: CanContain
): GroupResult<MoveOp> {
  const roots = groupRoots(paths);
  if (roots.some((path) => !nodeAt(tree, path))) return { ok: false, reason: 'missing' };
  // Up and indent walk forward; down and outdent walk backward, so no node overtakes another.
  const order = intent === 'up' || intent === 'indent' ? 'forward' : 'backward';
  return sequence(tree, roots, order, (current, path) =>
    keyboardMove(current, path, intent, canContain)
  );
}

/**
 * A drag of a selection dropped `before`, `after` or `inside` the row at
 * `target`: the group lands there together, in reading order.
 */
export function groupDropMove(
  tree: CatalogTreeInput,
  paths: readonly NodePath[],
  target: NodePath,
  position: DropPosition,
  canContain: CanContain
): GroupResult<MoveOp> {
  const roots = groupRoots(paths);
  if (roots.length === 0) return { ok: false, reason: 'root' };
  const targetNode = nodeAt(tree, target);
  if (!targetNode || roots.some((path) => !nodeAt(tree, path))) {
    return { ok: false, reason: 'missing' };
  }
  const inside = position === 'inside';
  if (roots.some((root) => isPrefix(root, target) && (inside || root.length < target.length))) {
    return { ok: false, reason: 'into-itself' };
  }
  let parent: number[];
  let index: number;
  if (inside) {
    if (!canContain(targetNode.id)) return { ok: false, reason: 'no-container' };
    parent = [...target];
    index = targetNode.children?.length ?? 0;
  } else {
    if (target.length === 0) return { ok: false, reason: 'root' };
    parent = target.slice(0, -1);
    index = (target[target.length - 1] ?? 0) + (position === 'after' ? 1 : 0);
  }
  // The insertion point, readdressed as each node leaves its old place.
  let point = { parent, index };
  return sequence(tree, roots, 'forward', (_current, path) => {
    const after = pathAfterRemoval(path, point.parent);
    if (!after) return { ok: false, reason: 'into-itself' };
    const sameParent = pathKey(path.slice(0, -1)) === pathKey(point.parent);
    const at =
      sameParent && (path[path.length - 1] ?? 0) < point.index ? point.index - 1 : point.index;
    point = { parent: after, index: at + 1 };
    return { ok: true, op: { op: 'move', path: [...path], parent: after, index: at } };
  });
}

/** Group delete: the selected subtrees, last first, so every path stays valid. */
export function groupRemoveOps(paths: readonly NodePath[]): RemoveOp[] {
  return groupRoots(paths)
    .reverse()
    .map((path) => ({ op: 'remove', path }));
}

// ── Duplicate, copy and paste ────────────────────────────────────────────

/** The block id rule (`@texuli/blocks`): lowercase letters, digits and hyphens, 1–48 long. */
const BLOCK_ID_MAX = 48;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Visit every block object (a record with a string `type`) inside a content block prop. */
function eachBlock(value: unknown, visit: (block: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) eachBlock(item, visit);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.type === 'string') visit(value);
  for (const child of Object.values(value)) eachBlock(child, visit);
}

function eachNode(node: CatalogTreeInput, visit: (node: CatalogTreeInput) => void): void {
  visit(node);
  for (const child of node.children ?? []) eachNode(child, visit);
}

/**
 * Block ids in a tree. A content block's `id` becomes an HTML id (heading
 * anchors), so a copy must never repeat one.
 */
export function blockIds(tree: CatalogTreeInput): Set<string> {
  const ids = new Set<string>();
  eachNode(tree, (node) => {
    eachBlock(node.props?.block, (block) => {
      if (typeof block.id === 'string') ids.add(block.id);
    });
  });
  return ids;
}

/**
 * A deterministic fresh id: `intro` → `intro-copy`, then `intro-copy-2`, …
 * Like the core id scopes, it counts instead of drawing random values, so
 * the same draft always duplicates the same way.
 */
export function freshBlockId(id: string, taken: ReadonlySet<string>): string {
  const base = id.replace(/-copy(-\d+)?$/, '') || 'block';
  for (let count = 1; ; count += 1) {
    const suffix = count === 1 ? '-copy' : `-copy-${count}`;
    const candidate = `${base.slice(0, BLOCK_ID_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * A deep copy of a subtree whose block ids are all new (added to `taken`).
 * Component ids, props and children are copied as plain JSON.
 */
export function cloneSubtree(node: CatalogTreeInput, taken: Set<string>): CatalogTreeInput {
  const copy = JSON.parse(JSON.stringify(node)) as CatalogTreeInput;
  eachNode(copy, (each) => {
    eachBlock(each.props?.block, (block) => {
      if (typeof block.id !== 'string') return;
      const id = freshBlockId(block.id, taken);
      taken.add(id);
      block.id = id;
    });
  });
  return copy;
}

/** Plain copies of the selected subtrees, in reading order: the outline clipboard. */
export function copySubtrees(
  tree: CatalogTreeInput,
  paths: readonly NodePath[]
): CatalogTreeInput[] {
  return groupRoots(paths).flatMap((path) => {
    const node = nodeAt(tree, path);
    return node ? [JSON.parse(JSON.stringify(node)) as CatalogTreeInput] : [];
  });
}

/** Each selected subtree, cloned with fresh block ids, inserted right after itself. */
export function duplicateOps(
  tree: CatalogTreeInput,
  paths: readonly NodePath[]
): GroupResult<InsertOp> {
  const roots = groupRoots(paths);
  if (roots.length === 0) return { ok: false, reason: 'root' };
  const taken = blockIds(tree);
  const ops: InsertOp[] = [];
  // Clones take fresh ids in reading order.
  for (const path of roots) {
    const node = nodeAt(tree, path);
    if (!node) return { ok: false, reason: 'missing' };
    ops.push({
      op: 'insert',
      parent: path.slice(0, -1),
      index: (path[path.length - 1] ?? 0) + 1,
      node: cloneSubtree(node, taken),
    });
  }
  // Applied last first: an insert never shifts a node earlier in reading order.
  ops.reverse();
  return { ok: true, ops, paths: placedPaths(ops) };
}

/**
 * Paste the clipboard: inside the selected component when it holds
 * children (as its last children), otherwise right after it. With nothing
 * selected, at the end of the page. Each paste clones with fresh block ids.
 */
export function pasteOps(
  tree: CatalogTreeInput,
  clipboard: readonly CatalogTreeInput[],
  at: NodePath,
  canContain: CanContain
): GroupResult<InsertOp> {
  if (clipboard.length === 0) return { ok: false, reason: 'empty-clipboard' };
  const target = nodeAt(tree, at) ?? tree;
  const path = nodeAt(tree, at) ? [...at] : [];
  let parent: number[];
  let index: number;
  if (canContain(target.id)) {
    parent = path;
    index = target.children?.length ?? 0;
  } else if (path.length > 0) {
    parent = path.slice(0, -1);
    index = (path[path.length - 1] ?? 0) + 1;
  } else {
    return { ok: false, reason: 'no-container' };
  }
  const taken = blockIds(tree);
  const ops: InsertOp[] = clipboard.map((node, offset) => ({
    op: 'insert',
    parent,
    index: index + offset,
    node: cloneSubtree(node, taken),
  }));
  return { ok: true, ops, paths: placedPaths(ops) };
}

/** "Card" for one node, "3 components" for several: history labels and announcements. */
export function groupName(
  tree: CatalogTreeInput,
  paths: readonly NodePath[],
  labelOf: (id: string) => string
): string {
  const first = paths[0];
  if (paths.length === 1 && first) {
    const node = nodeAt(tree, first);
    return node ? labelOf(node.id) : 'a component';
  }
  return `${paths.length} components`;
}
