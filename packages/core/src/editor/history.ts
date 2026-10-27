import {
  EDITOR_LIMITS,
  type EditorIssue,
  type EditorSelection,
  type EditorState,
  type EditorTransformResult,
} from './types.ts';

/**
 * What an edit was, for undo grouping. Consecutive `typing` (or `deletion`)
 * in one block within `EDITOR_HISTORY_MERGE_MS` is one undo step; an
 * `input-rule` is always its own step, so undo right after it restores the
 * characters the user typed.
 */
export type EditorEditKind = 'typing' | 'deletion' | 'input-rule' | 'other';

/** Pause after which typing starts a new undo step. */
export const EDITOR_HISTORY_MERGE_MS = 500;

export interface EditorHistory {
  past: readonly EditorState[];
  present: EditorState;
  future: readonly EditorState[];
  /** Why the last refused edit was refused (cleared by the next accepted action). */
  errors: readonly EditorIssue[];
  /** Snapshots kept in `past` (default 200). */
  limit: number;
  /** The last accepted edit, while it can still merge. */
  last: { kind: EditorEditKind; block: string | null; at: number } | null;
}

export type EditorHistoryAction =
  | { type: 'apply'; result: EditorTransformResult; kind?: EditorEditKind; at?: number }
  /** A selection change: no undo step, and the next edit starts a new one. */
  | { type: 'select'; selection: EditorSelection }
  | { type: 'undo' }
  | { type: 'redo' }
  /** A new document from outside: history restarts. */
  | { type: 'replace'; state: EditorState };

/** A history whose present is `state`. */
export function createEditorHistory(
  state: EditorState,
  options: { limit?: number } = {}
): EditorHistory {
  const limit = Math.max(1, Math.trunc(options.limit ?? EDITOR_LIMITS.history));
  return { past: [], present: state, future: [], errors: [], limit, last: null };
}

const focusBlock = (state: EditorState): string | null =>
  state.selection.kind === 'text' ? state.selection.focus.block : null;

/**
 * Snapshot-stack undo and redo (ADR-003). States are immutable and share
 * unchanged blocks, so a snapshot costs only what changed. A refused edit
 * keeps `present` and records `errors`.
 */
export function editorHistoryReducer(
  history: EditorHistory,
  action: EditorHistoryAction
): EditorHistory {
  switch (action.type) {
    case 'apply': {
      if (!action.result.ok) return { ...history, errors: action.result.errors };
      const state = action.result.state;
      if (state.doc === history.present.doc) return { ...history, present: state, errors: [] };
      const kind = action.kind ?? 'other';
      const at = action.at ?? 0;
      const block = focusBlock(state);
      const { last } = history;
      const merge =
        last !== null &&
        (kind === 'typing' || kind === 'deletion') &&
        last.kind === kind &&
        last.block === block &&
        at - last.at <= EDITOR_HISTORY_MERGE_MS;
      const past = merge ? history.past : [...history.past, history.present].slice(-history.limit);
      return {
        ...history,
        past,
        present: state,
        future: [],
        errors: [],
        last: { kind, block, at },
      };
    }
    case 'select':
      return {
        ...history,
        present: { ...history.present, selection: action.selection, storedMarks: null },
        last: null,
      };
    case 'undo': {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return {
        ...history,
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
        errors: [],
        last: null,
      };
    }
    case 'redo': {
      const [next, ...future] = history.future;
      if (!next) return history;
      return {
        ...history,
        past: [...history.past, history.present].slice(-history.limit),
        present: next,
        future,
        errors: [],
        last: null,
      };
    }
    case 'replace':
      return createEditorHistory(action.state, { limit: history.limit });
  }
}

export const canUndo = (history: EditorHistory): boolean => history.past.length > 0;
export const canRedo = (history: EditorHistory): boolean => history.future.length > 0;
