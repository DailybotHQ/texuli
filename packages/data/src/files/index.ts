/**
 * `@texuli/data/files` — grid/list file browser with breadcrumbs, previews
 * and multi-select. Hierarchy math lives in the framework-free engine
 * (`../engines/files`).
 */

export {
  breadcrumbs,
  categoryOf,
  childrenOf,
  descendantIds,
  extensionOf,
  type FileCategory,
  type FileEntry,
  formatSize,
  moveProblem,
  nameProblem,
  uniqueName,
} from '../engines/files/model.ts';
export {
  hashId,
  type ThumbnailOptions,
  thumbnailSvg,
  thumbnailUrl,
} from '../engines/files/thumbnail.ts';
export { default as FileBrowser } from './FileBrowser.svelte';
export {
  type FileBrowserLayout,
  type FilePreviewModel,
  moveFocusIndex,
  previewOf,
  toggleSelectedId,
} from './model.ts';
export type { FileBrowserLabels } from './types.ts';
