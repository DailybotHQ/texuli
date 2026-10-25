/**
 * Framework-free outline model: blueprint tree → rows, and keyboard or
 * drag intents → `move` edit ops (`@texuli/catalog/edit`). It imports only
 * `@texuli/catalog` types, so it can move into a future
 * `@texuli/builder/outline` unchanged (builder-design §10, draft).
 *
 * A `move` op removes the node first; `parent` and `index` address the tree
 * after that removal. Every function here returns ops in that addressing,
 * so the moved node's final path is always `[...op.parent, op.index]`.
 */
import type { EditOp } from '@texuli/catalog/edit';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';

export type NodePath = readonly number[];
export type MoveOp = Extract<EditOp, { op: 'move' }>;
export type MoveIntent = 'up' | 'down' | 'indent' | 'outdent';
export type DropPosition = 'before' | 'after' | 'inside';

export type MoveRefusal =
  | 'root'
  | 'first'
  | 'last'
  | 'no-container'
  | 'top-level'
  | 'into-itself'
  | 'same-place'
  | 'missing';

export type MoveResult = { ok: true; op: MoveOp } | { ok: false; reason: MoveRefusal };

export const REFUSAL_TEXT: Readonly<Record<MoveRefusal, string>> = Object.freeze({
  root: 'The page root cannot move.',
  first: 'Already first in its group.',
  last: 'Already last in its group.',
  'no-container': 'That component cannot hold other components.',
  'top-level': 'Already at the top level of the page.',
  'into-itself': 'A component cannot move into itself.',
  'same-place': 'That is where it already is.',
  missing: 'That row no longer exists.',
});

export interface OutlineRow {
  /** `path.join('.')`; `''` is the root. */
  key: string;
  path: number[];
  id: string;
  label: string;
  /** 1-based, for `aria-level`. */
  level: number;
  /** 1-based position among siblings, for `aria-posinset`. */
  position: number;
  /** Sibling count, for `aria-setsize`. */
  siblings: number;
  childCount: number;
  canContain: boolean;
}

export type CanContain = (id: string) => boolean;

export function pathKey(path: NodePath): string {
  return path.join('.');
}

export function nodeAt(tree: CatalogTreeInput, path: NodePath): CatalogTreeInput | undefined {
  let node: CatalogTreeInput | undefined = tree;
  for (const index of path) node = node?.children?.[index];
  return node;
}

/** Depth-first rows in reading order. */
export function outlineRows(
  tree: CatalogTreeInput,
  labelOf: (id: string) => string,
  canContain: CanContain
): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const visit = (node: CatalogTreeInput, path: number[], position: number, siblings: number) => {
    rows.push({
      key: pathKey(path),
      path,
      id: node.id,
      label: labelOf(node.id),
      level: path.length + 1,
      position,
      siblings,
      childCount: node.children?.length ?? 0,
      canContain: canContain(node.id),
    });
    const children = node.children ?? [];
    children.forEach((child, index) => {
      visit(child, [...path, index], index + 1, children.length);
    });
  };
  visit(tree, [], 1, 1);
  return rows;
}

function isPrefix(prefix: NodePath, path: NodePath): boolean {
  return prefix.length <= path.length && prefix.every((value, index) => path[index] === value);
}

/** Where `target` sits once the node at `from` has been removed (`null`: inside `from`). */
export function pathAfterRemoval(from: NodePath, target: NodePath): number[] | null {
  if (isPrefix(from, target)) return null;
  const level = from.length - 1;
  const adjusted = [...target];
  const sameParent = isPrefix(from.slice(0, level), target) && target.length > level;
  const at = adjusted[level];
  const removed = from[level];
  if (sameParent && at !== undefined && removed !== undefined && at > removed) {
    adjusted[level] = at - 1;
  }
  return adjusted;
}

function finish(from: NodePath, parent: number[], index: number): MoveResult {
  const current = from.slice(0, -1);
  if (pathKey(current) === pathKey(parent) && from[from.length - 1] === index) {
    return { ok: false, reason: 'same-place' };
  }
  return { ok: true, op: { op: 'move', path: [...from], parent, index } };
}

/** Alt+Arrow moves: up and down among siblings, indent into the previous sibling, outdent after the parent. */
export function keyboardMove(
  tree: CatalogTreeInput,
  path: NodePath,
  intent: MoveIntent,
  canContain: CanContain
): MoveResult {
  if (path.length === 0) return { ok: false, reason: 'root' };
  const node = nodeAt(tree, path);
  const parentPath = path.slice(0, -1);
  const parent = nodeAt(tree, parentPath);
  const index = path[path.length - 1] ?? 0;
  if (!node || !parent) return { ok: false, reason: 'missing' };
  const siblings = parent.children?.length ?? 0;
  if (intent === 'up') {
    if (index === 0) return { ok: false, reason: 'first' };
    return finish(path, parentPath, index - 1);
  }
  if (intent === 'down') {
    if (index >= siblings - 1) return { ok: false, reason: 'last' };
    return finish(path, parentPath, index + 1);
  }
  if (intent === 'indent') {
    const previous = index > 0 ? parent.children?.[index - 1] : undefined;
    if (!previous || !canContain(previous.id)) return { ok: false, reason: 'no-container' };
    // The previous sibling keeps its index when this node (after it) is removed.
    return finish(path, [...parentPath, index - 1], previous.children?.length ?? 0);
  }
  if (parentPath.length === 0) return { ok: false, reason: 'top-level' };
  const grandparent = parentPath.slice(0, -1);
  const parentIndex = parentPath[parentPath.length - 1] ?? 0;
  return finish(path, grandparent, parentIndex + 1);
}

/** A drag of `from` dropped `before`, `after` or `inside` the row at `target`. */
export function dropMove(
  tree: CatalogTreeInput,
  from: NodePath,
  target: NodePath,
  position: DropPosition,
  canContain: CanContain
): MoveResult {
  if (from.length === 0) return { ok: false, reason: 'root' };
  const node = nodeAt(tree, from);
  const targetNode = nodeAt(tree, target);
  if (!node || !targetNode) return { ok: false, reason: 'missing' };
  const adjusted = pathAfterRemoval(from, target);
  if (!adjusted) return { ok: false, reason: 'into-itself' };
  if (position === 'inside') {
    if (!canContain(targetNode.id)) return { ok: false, reason: 'no-container' };
    const fromIsChild = pathKey(from.slice(0, -1)) === pathKey(target);
    const length = (targetNode.children?.length ?? 0) - (fromIsChild ? 1 : 0);
    return finish(from, adjusted, length);
  }
  if (target.length === 0) return { ok: false, reason: 'root' };
  const parent = adjusted.slice(0, -1);
  const index = (adjusted[adjusted.length - 1] ?? 0) + (position === 'after' ? 1 : 0);
  return finish(from, parent, index);
}

/** Where a pointer at `offset` px into a row of `height` px drops. Containers take the middle half. */
export function dropPosition(offset: number, height: number, container: boolean): DropPosition {
  const ratio = height > 0 ? offset / height : 0.5;
  if (container) {
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'inside';
  }
  return ratio < 0.5 ? 'before' : 'after';
}

/** Live-region text after a move. */
export function moveAnnouncement(
  tree: CatalogTreeInput,
  op: MoveOp,
  labelOf: (id: string) => string
): string {
  const moved = nodeAt(tree, [...op.parent, op.index]);
  const parent = nodeAt(tree, op.parent);
  if (!moved || !parent) return 'Moved.';
  const count = parent.children?.length ?? 0;
  return `Moved ${labelOf(moved.id)} into ${labelOf(parent.id)}, position ${op.index + 1} of ${count}.`;
}

/** A manifest can hold children when it declares a `children` slot prop. */
export function manifestCanContain(manifest: {
  props: readonly { name: string; kind: string }[];
}): boolean {
  return manifest.props.some((prop) => prop.name === 'children' && prop.kind === 'slot');
}
