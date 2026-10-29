import { validateCatalogTreeLimits } from '../render/limits/validate.ts';
import type { CatalogTreeInput } from '../render/renderer/types.ts';
import { applyEditOps } from './ops.ts';
import type { ApplyEditOptions, EditError, EditOp, EditValidation } from './types.ts';

/** Default number of undo steps kept. */
export const DEFAULT_HISTORY_LIMIT = 200;

/** One committed step: what was applied and what undoes it. */
export interface EditEntry {
  ops: readonly EditOp[];
  inverse: readonly EditOp[];
  /** Consecutive applies with the same key merge into one step (typing). */
  coalesceKey?: string;
  before: CatalogTreeInput;
  after: CatalogTreeInput;
}

/**
 * What a listener receives. `ops` are the ops that took the tree from its
 * previous state to `tree` in this direction, so a host can replay them on
 * another copy (a server draft, a peer).
 */
export interface EditEvent {
  type: 'apply' | 'undo' | 'redo';
  ops: readonly EditOp[];
  tree: CatalogTreeInput;
}

export interface EditHistoryOptions {
  /**
   * The commit gate. A result it refuses is not committed. Defaults to the
   * tree limits (`validateCatalogTreeLimits`); hosts pass the full draft
   * validation (catalog ids, tiers, grammar) here.
   */
  validate?: (tree: CatalogTreeInput) => EditValidation;
  /** Undo steps kept; older steps are dropped. Default {@link DEFAULT_HISTORY_LIMIT}. */
  limit?: number;
  /** The document patcher `patchDocument` ops need (spec 0.7.0). */
  patchDocument?: ApplyEditOptions['patchDocument'];
}

export type HistoryApplyResult =
  | { ok: true; tree: CatalogTreeInput; changed: boolean }
  | { ok: false; error: EditError };

export interface EditHistory {
  readonly tree: CatalogTreeInput;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Apply ops as one step, all or none, through the commit gate. */
  apply(ops: EditOp | readonly EditOp[], options?: { coalesceKey?: string }): HistoryApplyResult;
  /** Step back. Returns false when there is nothing to undo. */
  undo(): boolean;
  /** Step forward. Returns false when there is nothing to redo. */
  redo(): boolean;
  /** Drop every step; the current tree stays. */
  clear(): void;
  /** Listen to applies, undos and redos. Returns the unsubscribe function. */
  subscribe(listener: (event: EditEvent) => void): () => void;
}

function limitsGate(tree: CatalogTreeInput): EditValidation {
  const { ok, diagnostics } = validateCatalogTreeLimits(tree);
  return { ok, diagnostics };
}

/**
 * Undo and redo over edit ops. Each committed step keeps its ops, its
 * inverse and the trees on both sides, so undo restores the exact previous
 * tree and listeners get ops they can replay elsewhere. Framework-free.
 */
export function createEditHistory(
  initial: CatalogTreeInput,
  options: EditHistoryOptions = {}
): EditHistory {
  const validate = options.validate ?? limitsGate;
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_HISTORY_LIMIT));
  const done: EditEntry[] = [];
  const undone: EditEntry[] = [];
  const listeners = new Set<(event: EditEvent) => void>();
  let tree = initial;

  const emit = (event: EditEvent): void => {
    for (const listener of listeners) listener(event);
  };

  return {
    get tree() {
      return tree;
    },
    get canUndo() {
      return done.length > 0;
    },
    get canRedo() {
      return undone.length > 0;
    },
    apply(input, applyOptions = {}) {
      const ops: readonly EditOp[] = Array.isArray(input) ? input : [input as EditOp];
      const result = applyEditOps(tree, ops, { patchDocument: options.patchDocument });
      if (!result.ok) return result;
      if (!result.changed) return { ok: true, tree, changed: false };
      const gate = validate(result.tree);
      if (!gate.ok) {
        return {
          ok: false,
          error: {
            code: 'validation-failed',
            message: 'The edit would leave the tree invalid; nothing was changed.',
            diagnostics: gate.diagnostics,
          },
        };
      }
      const before = tree;
      tree = result.tree;
      undone.length = 0;
      const last = done[done.length - 1];
      const key = applyOptions.coalesceKey;
      if (key !== undefined && last?.coalesceKey === key) {
        done[done.length - 1] = {
          ops: [...last.ops, ...ops],
          inverse: [...result.inverse, ...last.inverse],
          coalesceKey: key,
          before: last.before,
          after: tree,
        };
      } else {
        done.push({ ops, inverse: result.inverse, coalesceKey: key, before, after: tree });
        if (done.length > limit) done.shift();
      }
      emit({ type: 'apply', ops, tree });
      return { ok: true, tree, changed: true };
    },
    undo() {
      const entry = done.pop();
      if (entry === undefined) return false;
      tree = entry.before;
      // A step that was undone never merges with the next apply.
      undone.push({ ...entry, coalesceKey: undefined });
      emit({ type: 'undo', ops: entry.inverse, tree });
      return true;
    },
    redo() {
      const entry = undone.pop();
      if (entry === undefined) return false;
      tree = entry.after;
      done.push(entry);
      emit({ type: 'redo', ops: entry.ops, tree });
      return true;
    },
    clear() {
      done.length = 0;
      undone.length = 0;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
