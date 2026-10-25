import { isComposing, type KeyboardEventLike } from '../keyboard/keys.ts';
import {
  createShortcutMap,
  type ShortcutBinding,
  type ShortcutPlatform,
  type ShortcutStyle,
} from '../keyboard/shortcuts.ts';

/** What a key chord asks the editor to do. The binding maps intents to transforms. */
export type EditorKeyIntent =
  | 'toggle-strong'
  | 'toggle-em'
  | 'toggle-code'
  | 'toggle-strike'
  | 'link'
  | 'undo'
  | 'redo'
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'ordered-list'
  | 'bullet-list'
  | 'todo-list'
  | 'quote'
  | 'toggle-todo'
  /** Tab: indent a list item. Outside lists the binding lets Tab move focus. */
  | 'indent'
  | 'outdent'
  /** Leave the toolbar or dialog; in the text, let the next Tab leave the editor. */
  | 'escape';

/** The editor's key chords (ADR-003). `Mod` is ⌘ on Apple platforms, Ctrl elsewhere. */
export const EDITOR_SHORTCUTS: readonly ShortcutBinding<EditorKeyIntent>[] = [
  { id: 'toggle-strong', keys: 'Mod+B' },
  { id: 'toggle-em', keys: 'Mod+I' },
  { id: 'toggle-code', keys: 'Mod+E' },
  { id: 'toggle-strike', keys: 'Mod+Shift+X' },
  { id: 'link', keys: 'Mod+K' },
  { id: 'undo', keys: 'Mod+Z' },
  { id: 'redo', keys: ['Mod+Shift+Z', 'Mod+Y'] },
  { id: 'paragraph', keys: 'Mod+Alt+0' },
  { id: 'heading-1', keys: 'Mod+Alt+1' },
  { id: 'heading-2', keys: 'Mod+Alt+2' },
  { id: 'heading-3', keys: 'Mod+Alt+3' },
  { id: 'heading-4', keys: 'Mod+Alt+4' },
  { id: 'ordered-list', keys: 'Mod+Shift+7' },
  { id: 'bullet-list', keys: 'Mod+Shift+8' },
  { id: 'todo-list', keys: 'Mod+Shift+9' },
  { id: 'quote', keys: 'Mod+Shift+B' },
  { id: 'toggle-todo', keys: 'Mod+Enter' },
  { id: 'indent', keys: 'Tab' },
  { id: 'outdent', keys: 'Shift+Tab' },
  { id: 'escape', keys: 'Escape' },
];

export interface EditorKeymap {
  readonly platform: ShortcutPlatform;
  /** The intent of a keydown, or `null`. Composing events never match. */
  match(event: KeyboardEventLike): EditorKeyIntent | null;
  /** Value for `aria-keyshortcuts` on the control that runs `intent`. */
  ariaKeyShortcuts(intent: EditorKeyIntent): string;
  /** The chords of `intent`, formatted for tooltips and help text. */
  describe(intent: EditorKeyIntent, style?: ShortcutStyle): string[];
}

/** The editor keymap for one platform (see `detectPlatform`). */
export function createEditorKeymap(platform: ShortcutPlatform): EditorKeymap {
  const map = createShortcutMap(EDITOR_SHORTCUTS, platform);
  return {
    platform,
    match: (event) => (isComposing(event) ? null : map.match(event)),
    ariaKeyShortcuts: (intent) => map.ariaKeyShortcuts(intent),
    describe: (intent, style) => map.describe(intent, style),
  };
}

/** What a `beforeinput` event asks for. */
export type EditorInputIntent =
  | 'insert-text'
  | 'split-block'
  | 'insert-break'
  | 'delete-backward'
  | 'delete-forward'
  | 'delete-word-backward'
  | 'delete-word-forward'
  | 'delete-line-backward'
  | 'delete-line-forward'
  | 'delete-selection'
  | 'paste'
  | 'drop'
  | 'replace-text'
  | 'undo'
  | 'redo'
  | 'toggle-strong'
  | 'toggle-em'
  | 'toggle-strike'
  /** Leave the DOM alone; apply the change at `compositionend`. */
  | 'composition';

const INPUT_TYPES: Readonly<Record<string, EditorInputIntent>> = {
  insertText: 'insert-text',
  insertParagraph: 'split-block',
  insertLineBreak: 'insert-break',
  deleteContentBackward: 'delete-backward',
  deleteContentForward: 'delete-forward',
  deleteWordBackward: 'delete-word-backward',
  deleteWordForward: 'delete-word-forward',
  deleteSoftLineBackward: 'delete-line-backward',
  deleteHardLineBackward: 'delete-line-backward',
  deleteSoftLineForward: 'delete-line-forward',
  deleteHardLineForward: 'delete-line-forward',
  deleteContent: 'delete-selection',
  deleteByCut: 'delete-selection',
  deleteByDrag: 'delete-selection',
  insertFromPaste: 'paste',
  insertFromPasteAsQuotation: 'paste',
  insertFromDrop: 'drop',
  insertReplacementText: 'replace-text',
  insertFromYank: 'insert-text',
  historyUndo: 'undo',
  historyRedo: 'redo',
  formatBold: 'toggle-strong',
  formatItalic: 'toggle-em',
  formatStrikeThrough: 'toggle-strike',
  insertCompositionText: 'composition',
  deleteCompositionText: 'composition',
  insertFromComposition: 'composition',
};

/**
 * The intent of a `beforeinput` `inputType`, or `null` for types the editor
 * refuses (formatting it does not support, such as `formatUnderline`).
 */
export const intentFromInputType = (inputType: string): EditorInputIntent | null =>
  Object.hasOwn(INPUT_TYPES, inputType) ? (INPUT_TYPES[inputType] as EditorInputIntent) : null;
