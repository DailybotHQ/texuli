<script lang="ts">
import { Tree, type TreeNode } from '@texuli/primitives/tree';

const items: TreeNode[] = [
  {
    id: 'documents',
    label: 'Documents',
    children: [
      { id: 'brief', label: 'Project brief' },
      { id: 'budget', label: 'Budget' },
    ],
  },
  { id: 'archive', label: 'Archive', hasChildren: true },
  { id: 'locked', label: 'Locked folder', hasChildren: true, disabled: true },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `file-${index + 1}`,
    label: `File ${index + 1}`,
  })),
];

let expanded = $state<string[]>([]);
let selected = $state<string[]>([]);

async function loadChildren(node: TreeNode): Promise<readonly TreeNode[]> {
  await Promise.resolve();
  return [{ id: `${node.id}-child`, label: 'Archived file' }];
}
</script>

<Tree.Root
  {items}
  bind:expanded
  bind:selected
  virtualized
  selectionMode="multiple"
  height={120}
  rowHeight={30}
  overscan={1}
  {loadChildren}
  aria-label="Project files"
  data-tree-root
/>

<output data-expanded>{expanded.join(',')}</output>
<output data-selected>{selected.join(',')}</output>
