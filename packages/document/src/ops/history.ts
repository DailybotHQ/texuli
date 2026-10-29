/**
 * The op log and undo history of one document. Every applied transaction
 * (edits, undos and redos alike) is appended to an ordered log with a
 * sequence number, so a host can persist it, replay it or forward it to
 * sync (`since(seq)`); undo applies the recorded inverse as a new
 * transaction instead of rewinding the log.
 */
import type { TexuliDocument } from '../model/types.ts';
import {
  type ApplyOptions,
  type ApplyResult,
  applyOperations,
  type DocumentOperation,
} from './operations.ts';

export type OpLogKind = 'edit' | 'undo' | 'redo';

export interface OpLogEntry {
  /** 1, 2, 3, … in application order. */
  seq: number;
  kind: OpLogKind;
  operations: DocumentOperation[];
  /** Applying these undoes the entry. */
  inverse: DocumentOperation[];
  /** Who made the change (a host label, e.g. `local`, `agent` or a replica id). */
  origin?: string;
}

export interface DocumentHistoryOptions extends ApplyOptions {
  /** Undo steps kept (default 200). */
  limit?: number;
  /** Log entries kept in memory (default 10,000); the oldest drop first. */
  logLimit?: number;
}

export interface DocumentHistory {
  readonly document: TexuliDocument;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Apply a transaction and record it. */
  apply(operations: readonly DocumentOperation[], options?: { origin?: string }): ApplyResult;
  /** Undo the newest edit; false when there is nothing to undo or it no longer applies. */
  undo(): boolean;
  redo(): boolean;
  /** The kept log, oldest first. */
  log(): readonly OpLogEntry[];
  /** Entries after `seq` (exclusive). */
  since(seq: number): OpLogEntry[];
  /** Called after every change; returns an unsubscribe function. */
  subscribe(listener: (entry: OpLogEntry, document: TexuliDocument) => void): () => void;
}

/** Create a history over `initial` (which is never mutated). */
export function createDocumentHistory(
  initial: TexuliDocument,
  options: DocumentHistoryOptions = {}
): DocumentHistory {
  const limit = Math.max(0, Math.floor(options.limit ?? 200));
  const logLimit = Math.max(1, Math.floor(options.logLimit ?? 10_000));
  const applyOptions: ApplyOptions = { validate: options.validate };
  let current = initial;
  let seq = 0;
  const entries: OpLogEntry[] = [];
  const undoStack: DocumentOperation[][] = [];
  const redoStack: DocumentOperation[][] = [];
  const listeners = new Set<(entry: OpLogEntry, document: TexuliDocument) => void>();

  function record(
    kind: OpLogKind,
    operations: readonly DocumentOperation[],
    origin: string | undefined
  ): ApplyResult {
    const result = applyOperations(current, operations, applyOptions);
    if (!result.ok) return result;
    current = result.document;
    seq += 1;
    const entry: OpLogEntry = {
      seq,
      kind,
      operations: [...operations],
      inverse: result.inverse,
    };
    if (origin !== undefined) entry.origin = origin;
    entries.push(entry);
    if (entries.length > logLimit) entries.splice(0, entries.length - logLimit);
    for (const listener of listeners) listener(entry, current);
    return result;
  }

  return {
    get document() {
      return current;
    },
    get canUndo() {
      return undoStack.length > 0;
    },
    get canRedo() {
      return redoStack.length > 0;
    },
    apply(operations, applyOptionsForEntry = {}) {
      const result = record('edit', operations, applyOptionsForEntry.origin);
      if (result.ok && operations.length > 0) {
        undoStack.push(result.inverse);
        if (undoStack.length > limit) undoStack.splice(0, undoStack.length - limit);
        redoStack.length = 0;
      }
      return result;
    },
    undo() {
      const inverse = undoStack.at(-1);
      if (!inverse) return false;
      const result = record('undo', inverse, undefined);
      if (!result.ok) return false;
      undoStack.pop();
      redoStack.push(result.inverse);
      return true;
    },
    redo() {
      const operations = redoStack.at(-1);
      if (!operations) return false;
      const result = record('redo', operations, undefined);
      if (!result.ok) return false;
      redoStack.pop();
      undoStack.push(result.inverse);
      return true;
    },
    log() {
      return entries;
    },
    since(after) {
      return entries.filter((entry) => entry.seq > after);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
