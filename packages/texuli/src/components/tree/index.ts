export type { TreeNode, TreeSelectionMode, VisibleTreeNode } from '@texuli/primitives/tree';
export type { TreeViewProps } from './props.ts';
export { default as TreeView } from './TreeView.svelte';
export {
  TREE_DENSITIES,
  TREE_VARIANTS,
  type TreeDensity,
  type TreeVariant,
  treeViewClass,
} from './variants.ts';
