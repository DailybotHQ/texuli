import TreeRoot from './TreeRoot.svelte';

/** Headless, keyboard-operable tree with optional lazy children and virtualization. */
export const Tree: {
  readonly Root: typeof TreeRoot;
} = Object.freeze({ Root: TreeRoot });

export type { TreeNode, TreeSelectionMode, VisibleTreeNode } from './model.ts';
export { default as TreeRoot } from './TreeRoot.svelte';
