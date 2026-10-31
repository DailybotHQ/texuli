// @texuli/editor: the rich text editor on the @texuli/core editor texels.
// Each part is also its own subpath (editor, toolbar, link-dialog,
// controller, paste), so a host pays only for what it imports. The Markdown
// codec is only at `@texuli/editor/markdown`: it would grow this barrel by
// about 5 KB gzip for hosts that never read or write Markdown.
export {
  createEditorController,
  DEFAULT_EDITOR_LABELS,
  type EditorActiveState,
  type EditorBlockKind,
  EditorController,
  type EditorControllerOptions,
  type EditorLabels,
  type EditorToggleMark,
} from './controller/index.ts';
export { type EditorMediaResolver, EditorSurface, RichTextEditor } from './editor/index.ts';
export { LinkDialog } from './link-dialog/index.ts';
export {
  type ClipboardLike,
  EDITOR_CLIPBOARD_TYPE,
  importEditorJson,
  importHtml,
  importPlainText,
  PASTE_LIMITS,
  type PasteOptions,
  type PasteResult,
  type PasteSource,
  readClipboard,
} from './paste/index.ts';
export { EditorToolbar } from './toolbar/index.ts';

export const EDITOR_PACKAGE_VERSION = '0.11.1';
