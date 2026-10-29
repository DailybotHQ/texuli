import {
  DEFAULT_HISTORY_LIMIT,
  type EditHistory,
  type EditOp,
  getNode,
  type HistoryApplyResult,
  type NodePath,
} from '@texuli/catalog/edit';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';

/**
 * The builder's undo and redo layer over the catalog edit history: each step
 * carries a plain-language label ("Set title on Card"), so a history move can
 * announce what came back, and each move says which node to select after it.
 * Framework-free.
 */

/** What an undo or redo did, for the announcement and the selection. */
export interface HistoryMove {
  direction: 'undo' | 'redo';
  /** The label of the step that moved. */
  label: string;
  tree: CatalogTreeInput;
  /** The ops that took the tree to `tree` in this direction. */
  ops: readonly EditOp[];
}

export interface BuilderUndo {
  readonly tree: CatalogTreeInput;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** The label of the step Undo would revert, or `null`. */
  readonly undoLabel: string | null;
  /** The label of the step Redo would reapply, or `null`. */
  readonly redoLabel: string | null;
  /** Apply ops as one labeled step. A new step clears the redo stack. */
  apply(
    ops: EditOp | readonly EditOp[],
    options?: { coalesceKey?: string; label?: string }
  ): HistoryApplyResult;
  undo(): HistoryMove | null;
  redo(): HistoryMove | null;
}

type Step = { label: string; coalesceKey: string | undefined };

/**
 * Wrap `history` with step labels. The label stacks mirror the history's own
 * rules: same-key applies coalesce into one step (keeping the first label),
 * an undone step never coalesces again, a new step clears redo, and the
 * oldest steps drop past `limit`.
 */
export function createBuilderUndo(
  history: EditHistory,
  labelOf: (id: string) => string,
  limit = DEFAULT_HISTORY_LIMIT
): BuilderUndo {
  const done: Step[] = [];
  const undone: Step[] = [];
  let lastOps: readonly EditOp[] = [];
  history.subscribe((event) => {
    lastOps = event.ops;
  });

  const move = (direction: HistoryMove['direction'], step: Step): HistoryMove => ({
    direction,
    label: step.label,
    tree: history.tree,
    ops: lastOps,
  });

  return {
    get tree() {
      return history.tree;
    },
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    },
    get undoLabel() {
      return history.canUndo ? (done[done.length - 1]?.label ?? null) : null;
    },
    get redoLabel() {
      return history.canRedo ? (undone[undone.length - 1]?.label ?? null) : null;
    },
    apply(input, options = {}) {
      const ops: readonly EditOp[] = Array.isArray(input) ? input : [input as EditOp];
      const before = history.tree;
      const key = options.coalesceKey;
      const result = history.apply(ops, key === undefined ? undefined : { coalesceKey: key });
      if (!result.ok || !result.changed) return result;
      undone.length = 0;
      const last = done[done.length - 1];
      if (key === undefined || last?.coalesceKey !== key) {
        done.push({ label: options.label ?? describeEdit(before, ops, labelOf), coalesceKey: key });
        if (done.length > Math.max(1, Math.floor(limit))) done.shift();
      }
      return result;
    },
    undo() {
      if (!history.undo()) return null;
      const step = done.pop() ?? { label: 'the last change', coalesceKey: undefined };
      undone.push({ ...step, coalesceKey: undefined });
      return move('undo', step);
    },
    redo() {
      if (!history.redo()) return null;
      const step = undone.pop() ?? { label: 'the last change', coalesceKey: undefined };
      done.push(step);
      return move('redo', step);
    },
  };
}

/** A plain-language label for one step, read against the tree before it. */
export function describeEdit(
  before: CatalogTreeInput,
  ops: readonly EditOp[],
  labelOf: (id: string) => string
): string {
  const op = ops[0];
  if (!op) return 'No change';
  const name = (path: NodePath) => {
    const node = getNode(before, path);
    return node ? labelOf(node.id) : 'a component';
  };
  let label: string;
  switch (op.op) {
    case 'insert':
      label = `Insert ${labelOf(op.node.id)}`;
      break;
    case 'remove':
      label = `Remove ${name(op.path)}`;
      break;
    case 'move':
      label = `Move ${name(op.path)}`;
      break;
    case 'setProp':
      label = `Set ${op.name} on ${name(op.path)}`;
      break;
    case 'unsetProp':
      label = `Clear ${op.name} on ${name(op.path)}`;
      break;
    case 'replace':
      label = `Replace ${name(op.path)}`;
      break;
    case 'replaceAll':
      label = 'Replace the draft';
      break;
    case 'patchDocument':
      label = `Edit ${op.path ? name(op.path) : 'the document'}`;
      break;
  }
  return ops.length > 1 ? `${label} and ${ops.length - 1} more` : label;
}

/** The polite status for a history move: what came back, by name. */
export function announceMove(move: HistoryMove): string {
  return move.direction === 'undo' ? `Undid: ${move.label}.` : `Redid: ${move.label}.`;
}

/**
 * Where the selection goes after a history move, so the inspector shows what
 * came back: the node a prop change touched, a reinserted or moved node, the
 * parent of a node that went away. A whole-draft replacement keeps the
 * current selection when that node still exists. A path that no longer
 * exists falls back to its nearest existing ancestor.
 */
export function selectionAfterMove(move: HistoryMove, current: NodePath): number[] {
  const op = move.ops[move.ops.length - 1];
  let target: NodePath = current;
  if (op) {
    switch (op.op) {
      case 'setProp':
      case 'unsetProp':
      case 'replace':
      case 'remove':
        target = op.op === 'remove' ? op.path.slice(0, -1) : op.path;
        break;
      case 'insert':
        target = [...op.parent, op.index];
        break;
      case 'move':
        target = [...op.parent, op.index];
        break;
      case 'replaceAll':
        target = current;
        break;
    }
  }
  const path = [...target];
  while (path.length > 0 && !getNode(move.tree, path)) path.pop();
  return path;
}

/** Undo and redo shortcuts. `null` for any other key. */
export function historyShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): 'undo' | 'redo' | null {
  if (event.altKey || !(event.metaKey || event.ctrlKey)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) return 'redo';
  return null;
}

/**
 * Whether a keyboard target keeps its own text undo: text inputs, textareas
 * and editable content. The builder's shortcuts never take Cmd/Ctrl+Z from
 * them, so an uncommitted JSON buffer or a half-typed field undoes as text.
 */
export function ownsTextUndo(target: EventTarget | null): boolean {
  const element = target as {
    tagName?: string;
    type?: string;
    isContentEditable?: boolean;
  } | null;
  if (!element?.tagName) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag !== 'input') return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
    (element.type ?? 'text').toLowerCase()
  );
}
