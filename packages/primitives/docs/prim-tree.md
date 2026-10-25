# Tree primitive

`@texuli/primitives/tree` exports a headless, data-driven tree. `Tree.Root` keeps focus on the tree and exposes the active row through `aria-activedescendant`; row ids, levels and sibling positions are derived from the supplied hierarchy.

```svelte
<script lang="ts">
  import { Tree, type TreeNode } from '@texuli/primitives/tree';

  const files: TreeNode[] = [
    { id: 'docs', label: 'Documents', children: [{ id: 'brief', label: 'Brief.md' }] },
    { id: 'archive', label: 'Archive', hasChildren: true },
  ];

  let expanded = $state<string[]>([]);
  let selected = $state<string[]>([]);

  async function loadChildren(node: TreeNode): Promise<readonly TreeNode[]> {
    return [{ id: `${node.id}-report`, label: 'Report.pdf' }];
  }
</script>

<Tree.Root
  items={files}
  bind:expanded
  bind:selected
  selectionMode="multiple"
  {loadChildren}
  aria-label="Project files"
/>
```

Each node has a stable, unique, non-empty `id` and a text `label`. Supply `children` for eager branches or set `hasChildren` and provide `loadChildren(node)` for lazy branches. Loaded child ids must remain unique across the entire tree. A rejected loader leaves the branch expanded with the configurable `loadErrorLabel`; collapsing and reopening retries it.

`selectionMode` is `single` by default and can be `multiple` or `none`. `bind:selected` and `onSelectedChange` use arrays of node ids in every mode. `bind:expanded` and `onExpandedChange` use arrays of expanded branch ids. Pointer activation selects a row; the disclosure marker expands a branch. In multiple mode, Space and pointer activation toggle an individual selection.

Arrow Up/Down moves among visible enabled rows; Home/End moves to the first/last; Arrow Right expands a branch or enters its first child; Arrow Left collapses a branch or returns to its parent. Typing a label prefix uses the tree's typeahead. Enter selects the active row when selection is enabled.

Set `virtualized` to render a fixed-height window for long trees. `height`, `rowHeight` and `overscan` control the scroll viewport and window; the default window renders all visible rows. The fixed row-height option is required for correct scroll offsets. A custom `item` snippet receives a `VisibleTreeNode` with the node, level, set position, expansion, selection, loading and load-error state.
