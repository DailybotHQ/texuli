/**
 * `@texuli/data/tree-view` — outline / file-tree data view with lazy children,
 * drag reorder, checkboxes and keyboard outline edits.
 * Tree math lives in the framework-free engine (`../engines/tree`).
 */

export {
  buildTree,
  type FlatNode,
  type FlattenOptions,
  flatten,
  indent,
  isWithin,
  moveNode,
  moveSibling,
  newSibling,
  outdent,
  parentIn,
  pathTo,
  type TreeAccessors,
  type TreeIndex,
  type TreeMove,
  type TreeMoveResult,
  validParents,
} from '../engines/tree/index.ts';
export {
  depthIndentRem,
  dropAsChild,
  placementsOf,
  type TreePlacement,
} from './model.ts';
export { default as TreeDataView } from './TreeDataView.svelte';
export type { TreeDataViewLabels } from './types.ts';
