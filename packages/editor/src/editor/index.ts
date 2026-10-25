/**
 * `@texuli/editor/editor`: the rich text editor (toolbar, link dialog and the
 * editing surface) and the bare surface for hosts that bring their own chrome.
 */
export {
  BLOCK_ATTR,
  domBlockText,
  domToPoint,
  pointToDom,
  readDomSelection,
  sameSelection,
  VOID_ATTR,
  writeDomSelection,
} from './dom.ts';
export { default as EditorSurface } from './EditorSurface.svelte';
export { default as RichTextEditor } from './RichTextEditor.svelte';
export type { EditorMediaResolver } from './types.ts';
