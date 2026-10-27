import { describe, expect, it } from 'vitest';
import { deleteBackward, insertText, splitBlock, toggleMark } from '../src/editor/edit.ts';
import {
  canRedo,
  canUndo,
  createEditorHistory,
  EDITOR_HISTORY_MERGE_MS,
  type EditorHistory,
  editorHistoryReducer,
} from '../src/editor/history.ts';
import { createEditorKeymap, EDITOR_SHORTCUTS, intentFromInputType } from '../src/editor/keymap.ts';
import { toMarkdown } from '../src/editor/markdown.ts';
import { caret, type EditorState } from '../src/editor/model.ts';

const start = (): EditorState => ({
  doc: { version: 1, blocks: [{ id: 'p', type: 'paragraph', content: [] }] },
  selection: caret('p'),
});

const type = (history: EditorHistory, text: string, at: number) =>
  editorHistoryReducer(history, {
    type: 'apply',
    result: insertText(history.present, text),
    kind: 'typing',
    at,
  });

const textOf = (history: EditorHistory) => toMarkdown(history.present.doc);

describe('editor history', () => {
  it('merges quick typing in one block into one undo step', () => {
    let history = createEditorHistory(start());
    history = type(history, 'a', 0);
    history = type(history, 'b', 100);
    history = type(history, 'c', 200);
    expect(history.past).toHaveLength(1);
    history = editorHistoryReducer(history, { type: 'undo' });
    expect(textOf(history)).toBe('');
    expect(canRedo(history)).toBe(true);
    history = editorHistoryReducer(history, { type: 'redo' });
    expect(textOf(history)).toBe('abc');
  });

  it('starts a new step after a pause, a selection change, another kind or another block', () => {
    let history = createEditorHistory(start());
    history = type(history, 'a', 0);
    history = type(history, 'b', EDITOR_HISTORY_MERGE_MS + 1);
    expect(history.past).toHaveLength(2);
    history = editorHistoryReducer(history, { type: 'select', selection: caret('p', 0) });
    history = type(history, 'c', EDITOR_HISTORY_MERGE_MS + 2);
    expect(history.past).toHaveLength(3);
    history = editorHistoryReducer(history, {
      type: 'apply',
      result: deleteBackward(history.present),
      kind: 'deletion',
      at: EDITOR_HISTORY_MERGE_MS + 3,
    });
    expect(history.past).toHaveLength(4);
    history = editorHistoryReducer(history, {
      type: 'apply',
      result: splitBlock(history.present),
      at: EDITOR_HISTORY_MERGE_MS + 4,
    });
    history = type(history, 'd', EDITOR_HISTORY_MERGE_MS + 5);
    expect(history.past).toHaveLength(6);
  });

  it('restores the selection with each snapshot, and clears redo on a new edit', () => {
    let history = createEditorHistory(start());
    history = type(history, 'ab', 0);
    history = editorHistoryReducer(history, {
      type: 'apply',
      result: splitBlock(history.present),
      at: 10,
    });
    history = editorHistoryReducer(history, { type: 'undo' });
    expect(history.present.selection).toEqual(caret('p', 2));
    history = type(history, 'x', 20);
    expect(canRedo(history)).toBe(false);
  });

  it('keeps present on a refused edit and records why', () => {
    let history = createEditorHistory(start());
    const before = history.present;
    history = editorHistoryReducer(history, {
      type: 'apply',
      result: deleteBackward(history.present),
    });
    expect(history.present).toBe(before);
    expect(history.errors[0]?.code).toBe('nothing-to-do');
    expect(canUndo(history)).toBe(false);
    expect(editorHistoryReducer(history, { type: 'undo' })).toBe(history);
  });

  it('does not create an undo step when a caret mark toggle leaves the document unchanged', () => {
    let history = createEditorHistory(start());
    history = editorHistoryReducer(history, {
      type: 'apply',
      result: toggleMark(history.present, 'strong'),
    });
    expect(canUndo(history)).toBe(false);
    expect(history.present.storedMarks).toEqual([{ type: 'strong' }]);
  });

  it('keeps at most `limit` snapshots, and restarts on replace', () => {
    let history = createEditorHistory(start(), { limit: 3 });
    for (let i = 0; i < 10; i += 1) history = type(history, String(i), i * 10_000);
    expect(history.past).toHaveLength(3);
    expect(toMarkdown((history.past[0] as EditorState).doc)).toBe('0123456');
    history = editorHistoryReducer(history, { type: 'replace', state: start() });
    expect(history.past).toHaveLength(0);
    expect(history.limit).toBe(3);
    expect(createEditorHistory(start()).limit).toBe(200);
  });
});

describe('editor keymap', () => {
  it('maps chords per platform and never matches while composing', () => {
    const mac = createEditorKeymap('mac');
    const other = createEditorKeymap('other');
    expect(mac.match({ key: 'b', metaKey: true })).toBe('toggle-strong');
    expect(other.match({ key: 'b', ctrlKey: true })).toBe('toggle-strong');
    expect(other.match({ key: 'b', metaKey: true })).toBeNull();
    expect(other.match({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(other.match({ key: 'y', ctrlKey: true })).toBe('redo');
    expect(other.match({ key: '&', code: 'Digit7', ctrlKey: true, shiftKey: true })).toBe(
      'ordered-list'
    );
    expect(mac.match({ key: '¡', code: 'Digit1', metaKey: true, altKey: true })).toBe('heading-1');
    expect(other.match({ key: 'Tab' })).toBe('indent');
    expect(other.match({ key: 'Tab', shiftKey: true })).toBe('outdent');
    expect(other.match({ key: 'b', ctrlKey: true, isComposing: true })).toBeNull();
    expect(other.match({ key: 'Process', keyCode: 229 })).toBeNull();
    expect(other.match({ key: 'q', ctrlKey: true })).toBeNull();
    expect(mac.ariaKeyShortcuts('redo')).toBe('Shift+Meta+Z Meta+Y');
    expect(other.describe('link', 'text')).toEqual(['Ctrl+K']);
    expect(new Set(EDITOR_SHORTCUTS.map((b) => b.id)).size).toBe(EDITOR_SHORTCUTS.length);
  });

  it('maps beforeinput types to intents and refuses the rest', () => {
    expect(intentFromInputType('insertText')).toBe('insert-text');
    expect(intentFromInputType('insertParagraph')).toBe('split-block');
    expect(intentFromInputType('insertLineBreak')).toBe('insert-break');
    expect(intentFromInputType('deleteWordBackward')).toBe('delete-word-backward');
    expect(intentFromInputType('deleteHardLineForward')).toBe('delete-line-forward');
    expect(intentFromInputType('insertFromPaste')).toBe('paste');
    expect(intentFromInputType('insertCompositionText')).toBe('composition');
    expect(intentFromInputType('historyUndo')).toBe('undo');
    expect(intentFromInputType('formatUnderline')).toBeNull();
    expect(intentFromInputType('toString')).toBeNull();
  });
});
