/**
 * Framework-free undo/redo stack for grid cell edits.
 */
import type { GridValue } from '../engines/grid/columns.ts';

export interface CellEditOp {
  rowId: string;
  columnKey: string;
  previous: GridValue;
  next: GridValue;
}

export interface UndoStack {
  readonly limit: number;
  /** Past ops, oldest first. */
  past(): readonly CellEditOp[];
  /** Future ops after undo. */
  future(): readonly CellEditOp[];
  canUndo(): boolean;
  canRedo(): boolean;
  push(op: CellEditOp): void;
  /** Pop the last op for the host to reverse. */
  undo(): CellEditOp | null;
  /** Pop a redo op for the host to re-apply. */
  redo(): CellEditOp | null;
  clear(): void;
}

export interface UndoStackOptions {
  /** Max past depth. Default 50. */
  limit?: number;
}

export function createUndoStack(options: UndoStackOptions = {}): UndoStack {
  const limit = Math.max(1, Math.trunc(options.limit ?? 50));
  let past: CellEditOp[] = [];
  let future: CellEditOp[] = [];

  return {
    limit,
    past: () => past,
    future: () => future,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    push(op) {
      past = [...past, op].slice(-limit);
      future = [];
    },
    undo() {
      const op = past.at(-1);
      if (!op) return null;
      past = past.slice(0, -1);
      future = [...future, op];
      return op;
    },
    redo() {
      const op = future.at(-1);
      if (!op) return null;
      future = future.slice(0, -1);
      past = [...past, op].slice(-limit);
      return op;
    },
    clear() {
      past = [];
      future = [];
    },
  };
}
