/**
 * Undo and redo over the op log: each step stores the operations it applied
 * and their inverse, so undo applies the inverse and redo the operations
 * again (never a snapshot rewind). Consecutive steps with the same `merge`
 * key (a run of arrow-key nudges, a drag) become one step.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import { CANVAS_LIMITS } from './limits.ts';
import { applyCanvasOps, type CanvasApplyResult, type CanvasOperation } from './ops.ts';
import type { CanvasDocument } from './types.ts';

export interface CanvasStep {
  ops: CanvasOperation[];
  inverse: CanvasOperation[];
  /** What the step did, for announcements ("Moved 2 shapes"). */
  label?: string;
  merge?: string;
}

export interface CanvasHistory {
  /** The current document. */
  readonly doc: CanvasDocument;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Steps that undo would revert, oldest first. */
  readonly steps: readonly CanvasStep[];
  /** Apply a batch as one step (all or none). */
  apply(
    ops: readonly CanvasOperation[],
    options?: { label?: string; merge?: string }
  ): CanvasApplyResult;
  /** Revert the last step; returns it, or `null` when there is none. */
  undo(): CanvasStep | null;
  redo(): CanvasStep | null;
  /** Replace the document and forget every step (a remote reload). */
  reset(doc: CanvasDocument): void;
}

export interface CanvasHistoryOptions {
  /** Steps kept (default `CANVAS_LIMITS.history`). */
  limit?: number;
  trust?: HrefTrust;
}

export function createCanvasHistory(
  initial: CanvasDocument,
  options: CanvasHistoryOptions = {}
): CanvasHistory {
  const limit = Math.max(1, Math.floor(options.limit ?? CANVAS_LIMITS.history));
  const trust = options.trust;
  let doc = initial;
  let done: CanvasStep[] = [];
  let undone: CanvasStep[] = [];
  return {
    get doc() {
      return doc;
    },
    get canUndo() {
      return done.length > 0;
    },
    get canRedo() {
      return undone.length > 0;
    },
    get steps() {
      return done;
    },
    apply(ops, settings = {}) {
      const result = applyCanvasOps(doc, ops, { trust });
      if (!result.ok || ops.length === 0) return result;
      doc = result.doc;
      undone = [];
      const last = done[done.length - 1];
      if (settings.merge !== undefined && last?.merge === settings.merge) {
        last.ops = [...last.ops, ...ops];
        last.inverse = [...result.inverse, ...last.inverse];
      } else {
        done.push({
          ops: [...ops],
          inverse: result.inverse,
          ...(settings.label !== undefined ? { label: settings.label } : {}),
          ...(settings.merge !== undefined ? { merge: settings.merge } : {}),
        });
        if (done.length > limit) done = done.slice(done.length - limit);
      }
      return result;
    },
    undo() {
      const step = done.pop();
      if (!step) return null;
      const result = applyCanvasOps(doc, step.inverse, { trust });
      if (!result.ok) {
        // The step no longer applies (a remote change removed what it touched): drop it.
        return null;
      }
      doc = result.doc;
      undone.push({ ...step, ops: step.ops, inverse: step.inverse });
      return step;
    },
    redo() {
      const step = undone.pop();
      if (!step) return null;
      const result = applyCanvasOps(doc, step.ops, { trust });
      if (!result.ok) return null;
      doc = result.doc;
      // Redo may produce a different inverse (ids are stable, positions may not be).
      done.push({ ...step, inverse: result.inverse });
      return step;
    },
    reset(next) {
      doc = next;
      done = [];
      undone = [];
    },
  };
}
