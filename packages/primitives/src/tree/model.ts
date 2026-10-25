export interface TreeNode {
  id: string;
  label: string;
  children?: readonly TreeNode[];
  /** A lazy node has children that have not been requested yet. */
  hasChildren?: boolean;
  disabled?: boolean;
}

export type TreeSelectionMode = 'none' | 'single' | 'multiple';

export interface VisibleTreeNode {
  node: TreeNode;
  level: number;
  posInSet: number;
  setSize: number;
  parentId?: string;
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  loading: boolean;
  loadError: boolean;
}

export interface TreeWindow {
  start: number;
  end: number;
  paddingStart: number;
  paddingEnd: number;
}

export function hasTreeChildren(node: TreeNode, loadedChildren?: readonly TreeNode[]): boolean {
  if (node.hasChildren !== undefined) return node.hasChildren;
  return (loadedChildren ?? node.children ?? []).length > 0;
}

/** Flatten only expanded branches, retaining each row's ARIA hierarchy metadata. */
export function flattenVisibleTree(
  nodes: readonly TreeNode[],
  expandedIds: ReadonlySet<string>,
  selectedIds: ReadonlySet<string>,
  options: {
    loadedChildren?: ReadonlyMap<string, readonly TreeNode[]>;
    loadingIds?: ReadonlySet<string>;
    failedIds?: ReadonlySet<string>;
  } = {}
): VisibleTreeNode[] {
  const rows: VisibleTreeNode[] = [];
  const visit = (siblings: readonly TreeNode[], level: number, parentId?: string): void => {
    siblings.forEach((node, index) => {
      const children = options.loadedChildren?.get(node.id) ?? node.children ?? [];
      const expanded = expandedIds.has(node.id);
      const hasChildren = hasTreeChildren(node, options.loadedChildren?.get(node.id));
      rows.push({
        node,
        level,
        posInSet: index + 1,
        setSize: siblings.length,
        ...(parentId === undefined ? {} : { parentId }),
        hasChildren,
        expanded,
        selected: selectedIds.has(node.id),
        loading: options.loadingIds?.has(node.id) ?? false,
        loadError: options.failedIds?.has(node.id) ?? false,
      });
      if (expanded && children.length > 0) visit(children, level + 1, node.id);
    });
  };
  visit(nodes, 1);
  return rows;
}

/** Reject duplicate or empty ids before they create ambiguous active-descendant references. */
export function assertUniqueTreeIds(
  nodes: readonly TreeNode[],
  loadedChildren: ReadonlyMap<string, readonly TreeNode[]> = new Map()
): void {
  const ids = new Set<string>();
  const visit = (siblings: readonly TreeNode[]): void => {
    for (const node of siblings) {
      if (!node.id.trim()) throw new Error('Tree node ids must not be empty.');
      if (ids.has(node.id)) throw new Error(`Tree node id "${node.id}" is duplicated.`);
      ids.add(node.id);
      visit(loadedChildren.get(node.id) ?? node.children ?? []);
    }
  };
  visit(nodes);
}

/** Fixed-height virtual range with an overscan buffer on both sides. */
export function getTreeWindow(
  count: number,
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  overscan = 3
): TreeWindow {
  if (count <= 0) return { start: 0, end: 0, paddingStart: 0, paddingEnd: 0 };
  const row = Math.max(1, Number.isFinite(rowHeight) ? rowHeight : 36);
  const height = Math.max(row, Number.isFinite(viewportHeight) ? viewportHeight : row * 8);
  const extra = Math.max(0, Math.floor(overscan));
  const start = Math.max(0, Math.floor(Math.max(0, scrollTop) / row) - extra);
  const end = Math.min(count, Math.ceil((Math.max(0, scrollTop) + height) / row) + extra);
  return {
    start,
    end,
    paddingStart: start * row,
    paddingEnd: Math.max(0, (count - end) * row),
  };
}
