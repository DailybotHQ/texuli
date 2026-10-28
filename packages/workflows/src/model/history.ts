import { applyWorkflowOps, type WorkflowContext } from './ops.ts';
import type { NodeMove, WorkflowError, WorkflowGraph, WorkflowOp } from './types.ts';

/** Default number of undo steps kept. */
export const DEFAULT_WORKFLOW_HISTORY_LIMIT = 200;

/** One committed step: what was applied and what undoes it. */
export interface WorkflowEntry {
  ops: readonly WorkflowOp[];
  inverse: readonly WorkflowOp[];
  /** Consecutive applies with the same key merge into one step (a drag). */
  coalesceKey?: string;
  before: WorkflowGraph;
  after: WorkflowGraph;
}

/**
 * What a listener receives. `ops` took the graph from its previous state to
 * `graph` in this direction, so a host can replay them on another copy.
 */
export interface WorkflowEvent {
  type: 'apply' | 'undo' | 'redo';
  ops: readonly WorkflowOp[];
  graph: WorkflowGraph;
}

export interface WorkflowValidation {
  ok: boolean;
  diagnostics: readonly unknown[];
}

export interface WorkflowHistoryOptions extends WorkflowContext {
  /** An extra commit gate (host rules); a result it refuses is not committed. */
  validate?: (graph: WorkflowGraph) => WorkflowValidation;
  /** Undo steps kept; older steps are dropped. */
  limit?: number;
}

export type WorkflowHistoryResult =
  | { ok: true; graph: WorkflowGraph; changed: boolean }
  | { ok: false; error: WorkflowError };

export interface WorkflowHistory {
  readonly graph: WorkflowGraph;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /**
   * Apply ops as one step, all or none. Pass the same `coalesceKey` for
   * every step of a drag so the whole gesture undoes at once.
   */
  apply(
    ops: WorkflowOp | readonly WorkflowOp[],
    options?: { coalesceKey?: string }
  ): WorkflowHistoryResult;
  undo(): boolean;
  redo(): boolean;
  /** Drop every step; the current graph stays. */
  clear(): void;
  subscribe(listener: (event: WorkflowEvent) => void): () => void;
}

/**
 * Fold consecutive `moveNodes` ops into one: the forward op keeps each
 * node's latest position, the inverse keeps its first. A drag of a thousand
 * pointer moves stays one small step.
 */
function mergeMoves(
  earlier: readonly WorkflowOp[],
  later: readonly WorkflowOp[]
): readonly WorkflowOp[] | undefined {
  const a = earlier.length === 1 ? earlier[0] : undefined;
  const b = later.length === 1 ? later[0] : undefined;
  if (a?.op !== 'moveNodes' || b?.op !== 'moveNodes') return undefined;
  const moves = new Map<string, NodeMove>(a.moves.map((move) => [move.id, move]));
  for (const move of b.moves) moves.set(move.id, move);
  return [{ op: 'moveNodes', moves: [...moves.values()] }];
}

/**
 * Undo and redo over workflow ops, mirroring the catalog's edit history.
 * Each step keeps its ops, its inverse and the graphs on both sides, so undo
 * restores the exact previous graph. Framework-free.
 */
export function createWorkflowHistory(
  initial: WorkflowGraph,
  options: WorkflowHistoryOptions
): WorkflowHistory {
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_WORKFLOW_HISTORY_LIMIT));
  const done: WorkflowEntry[] = [];
  const undone: WorkflowEntry[] = [];
  const listeners = new Set<(event: WorkflowEvent) => void>();
  let graph = initial;

  const emit = (event: WorkflowEvent): void => {
    for (const listener of listeners) listener(event);
  };

  return {
    get graph() {
      return graph;
    },
    get canUndo() {
      return done.length > 0;
    },
    get canRedo() {
      return undone.length > 0;
    },
    apply(input, applyOptions = {}) {
      const ops: readonly WorkflowOp[] = Array.isArray(input) ? input : [input as WorkflowOp];
      const result = applyWorkflowOps(graph, ops, options);
      if (!result.ok) return result;
      if (!result.changed) return { ok: true, graph, changed: false };
      const gate = options.validate?.(result.graph);
      if (gate && !gate.ok) {
        return {
          ok: false,
          error: {
            code: 'validation-failed',
            message: 'The edit would leave the workflow invalid; nothing was changed.',
            diagnostics: gate.diagnostics,
          },
        };
      }
      const before = graph;
      graph = result.graph;
      undone.length = 0;
      const last = done[done.length - 1];
      const key = applyOptions.coalesceKey;
      if (key !== undefined && last?.coalesceKey === key) {
        done[done.length - 1] = {
          ops: mergeMoves(last.ops, ops) ?? [...last.ops, ...ops],
          inverse: mergeMoves(result.inverse, last.inverse) ?? [...result.inverse, ...last.inverse],
          coalesceKey: key,
          before: last.before,
          after: graph,
        };
      } else {
        done.push({ ops, inverse: result.inverse, coalesceKey: key, before, after: graph });
        if (done.length > limit) done.shift();
      }
      emit({ type: 'apply', ops, graph });
      return { ok: true, graph, changed: true };
    },
    undo() {
      const entry = done.pop();
      if (entry === undefined) return false;
      graph = entry.before;
      // A step that was undone never merges with the next apply.
      undone.push({ ...entry, coalesceKey: undefined });
      emit({ type: 'undo', ops: entry.inverse, graph });
      return true;
    },
    redo() {
      const entry = undone.pop();
      if (entry === undefined) return false;
      graph = entry.after;
      done.push(entry);
      emit({ type: 'redo', ops: entry.ops, graph });
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
