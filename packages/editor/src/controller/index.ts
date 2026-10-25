/**
 * `@texuli/editor/controller`: the headless editor (history, commands,
 * composition guard and announcements) over the `@texuli/core` editor
 * texels. No DOM; bind it to any surface.
 */
export {
  createEditorController,
  type EditorActiveState,
  type EditorBlockKind,
  EditorController,
  type EditorControllerOptions,
  type EditorToggleMark,
} from './controller.svelte.ts';
export { DEFAULT_EDITOR_LABELS, type EditorLabels } from './labels.ts';
