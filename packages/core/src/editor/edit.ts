/**
 * `@texuli/core/editor-transforms`: pure editor transforms and Markdown input
 * rules (ADR-003). Each takes an `EditorState` and returns a new state or the
 * issues that refused the edit; unchanged blocks keep their identity.
 */
export { applyInputRules } from './input-rules.ts';
export {
  applyComposition,
  blockKindAt,
  deleteBackward,
  deleteForward,
  deleteSelection,
  type EditorBlockKindChoice,
  type EditorDeleteUnit,
  type EditorTransformOptions,
  type EditorVoidInsert,
  editorTextBlock,
  insertBlock,
  insertBreak,
  insertText,
  liftListItem,
  moveBlock,
  removeLink,
  replaceSelection,
  type SetLinkOptions,
  setBlockKind,
  setBlockType,
  setLink,
  sinkListItem,
  splitBlock,
  toggleList,
  toggleMark,
  toggleQuote,
  toggleTodo,
} from './transforms.ts';
